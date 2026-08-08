#!/usr/bin/env python3
"""Initialize and verify a minimal SAS/OKF run bundle."""

from __future__ import annotations

import argparse
from datetime import UTC, datetime
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import sys


SCHEMA = "copernicus.graph.v1"
RECORD_ID = re.compile(r"[A-Za-z0-9][A-Za-z0-9._:-]{0,127}")
LANES = {"deterministic", "sol", "terra", "luna", "human"}
KINDS = {
    "regime",
    "card_selection",
    "candidate",
    "evaluation",
    "review",
    "cycle_join",
    "card_disposition",
}
NODE_FIELDS = {
    "id",
    "role",
    "lane",
    "depends_on",
    "input",
    "output",
    "authority",
    "verifier",
    "falsifier",
    "status",
}
MARKDOWN_LINK = re.compile(r"\[[^\]]+\]\(([^)]+)\)")


class ReceiptError(ValueError):
    pass


def canonical(value: object) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=True).encode()


def digest(value: object) -> str:
    return "sha256:" + hashlib.sha256(canonical(value)).hexdigest()


def file_digest(path: Path) -> str:
    return "sha256:" + hashlib.sha256(path.read_bytes()).hexdigest()


def timestamp() -> str:
    return datetime.now(UTC).isoformat(timespec="seconds")


def verify_ledger(path: Path) -> list[str]:
    errors: list[str] = []
    previous = None
    seen: set[str] = set()
    if not path.exists():
        return [f"missing ledger: {path}"]
    for number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        try:
            row = json.loads(line)
        except json.JSONDecodeError:
            errors.append(f"ledger row {number}: invalid JSON")
            continue
        if not isinstance(row, dict):
            errors.append(f"ledger row {number}: expected object")
            continue
        claimed = row.get("record_sha256")
        body = {key: value for key, value in row.items() if key != "record_sha256"}
        if body.get("previous_record_sha256") != previous:
            errors.append(f"ledger row {number}: broken chain")
        if claimed != digest(body):
            errors.append(f"ledger row {number}: record hash mismatch")
        record_id = body.get("record_id")
        if record_id in seen:
            errors.append(f"ledger row {number}: duplicate record_id")
        if not isinstance(record_id, str) or not RECORD_ID.fullmatch(record_id):
            errors.append(f"ledger row {number}: invalid record_id")
        if body.get("kind") not in KINDS:
            errors.append(f"ledger row {number}: invalid kind")
        unsealed = {key: value for key, value in body.items() if key != "previous_record_sha256"}
        try:
            validate_record(unsealed)
        except ReceiptError as exc:
            errors.append(f"ledger row {number}: {exc}")
        seen.add(record_id)
        previous = claimed
    return errors


def validate_record(record: object) -> dict:
    if not isinstance(record, dict):
        raise ReceiptError("receipt must be a JSON object")
    required = {"record_id", "kind", "source", "falsifier", "payload"}
    missing = sorted(required - record.keys())
    if missing:
        raise ReceiptError("receipt missing: " + ", ".join(missing))
    if not isinstance(record["record_id"], str) or not RECORD_ID.fullmatch(record["record_id"]):
        raise ReceiptError("invalid record_id")
    if record["kind"] not in KINDS:
        raise ReceiptError(f"invalid kind: {record['kind']!r}")
    for field in ("source", "falsifier"):
        if not isinstance(record[field], str) or not record[field].strip():
            raise ReceiptError(f"{field} must be a non-empty string")
    if not isinstance(record["payload"], dict):
        raise ReceiptError("payload must be an object")
    forbidden = {"record_sha256", "previous_record_sha256"} & record.keys()
    if forbidden:
        raise ReceiptError("receipt cannot pre-seal: " + ", ".join(sorted(forbidden)))
    return record


def append_record(path: Path, record: dict) -> dict:
    path.parent.mkdir(parents=True, exist_ok=True)
    lock_path = path.with_name(path.name + ".lock")
    descriptor = os.open(lock_path, os.O_CREAT | os.O_RDWR, 0o600)
    with os.fdopen(descriptor, "r+") as lock:
        # ponytail: one ledger lock; shard by run only after measured write contention.
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError as exc:
            raise ReceiptError(f"ledger is being written: {path}") from exc
        if not path.exists():
            path.touch(mode=0o600)
        errors = verify_ledger(path)
        if errors:
            raise ReceiptError("ledger invalid: " + "; ".join(errors))
        rows = [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines()]
        if any(row["record_id"] == record["record_id"] for row in rows):
            raise ReceiptError(f"duplicate record_id: {record['record_id']}")
        sealed = dict(record)
        sealed.setdefault("observed_at", timestamp())
        sealed["previous_record_sha256"] = rows[-1]["record_sha256"] if rows else None
        sealed["record_sha256"] = digest(sealed)
        with path.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(sealed, sort_keys=True) + "\n")
            handle.flush()
            os.fsync(handle.fileno())
        return sealed


def verify_graph(path: Path) -> list[str]:
    try:
        graph = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return [f"missing graph: {path}"]
    except json.JSONDecodeError as exc:
        return [f"graph invalid JSON: {exc.msg}"]
    if not isinstance(graph, dict):
        return ["graph must be an object"]
    errors: list[str] = []
    if graph.get("schema_version") != SCHEMA:
        errors.append(f"graph schema must be {SCHEMA}")
    if graph.get("status") not in {"draft", "ready", "complete"}:
        errors.append("graph status must be draft, ready, or complete")
    problem_hash = graph.get("problem_sha256")
    if not isinstance(problem_hash, str) or not problem_hash.startswith("sha256:"):
        errors.append("graph problem_sha256 is invalid")
    budgets = graph.get("budgets")
    if not isinstance(budgets, dict) or any(
        not isinstance(budgets.get(key), int) or budgets[key] < 1
        for key in ("max_seats", "max_cycles")
    ):
        errors.append("graph budgets require positive max_seats and max_cycles")
    nodes = graph.get("nodes")
    if not isinstance(nodes, list):
        return errors + ["graph nodes must be an array"]
    if isinstance(budgets, dict) and isinstance(budgets.get("max_seats"), int) and len(nodes) > budgets["max_seats"]:
        errors.append("graph nodes exceed max_seats")
    if graph.get("status") in {"ready", "complete"} and not nodes:
        errors.append("ready graph has no nodes")
    by_id: dict[str, dict] = {}
    for number, node in enumerate(nodes, 1):
        if not isinstance(node, dict) or set(node) != NODE_FIELDS:
            errors.append(f"graph node {number}: expected exact node contract")
            continue
        node_id = node["id"]
        if not isinstance(node_id, str) or not RECORD_ID.fullmatch(node_id):
            errors.append(f"graph node {number}: invalid id")
            continue
        if node_id in by_id:
            errors.append(f"graph node {number}: duplicate id {node_id}")
            continue
        if node["lane"] not in LANES:
            errors.append(f"graph node {node_id}: invalid lane")
        if not isinstance(node["depends_on"], list) or any(
            not isinstance(value, str) for value in node["depends_on"]
        ):
            errors.append(f"graph node {node_id}: depends_on must be string array")
        for field in NODE_FIELDS - {"id", "lane", "depends_on"}:
            if not isinstance(node[field], str) or not node[field].strip():
                errors.append(f"graph node {node_id}: {field} must be non-empty")
        by_id[node_id] = node
    for node_id, node in by_id.items():
        for dependency in node["depends_on"]:
            if dependency not in by_id:
                errors.append(f"graph node {node_id}: missing dependency {dependency}")
    visiting: set[str] = set()
    visited: set[str] = set()

    def visit(node_id: str) -> None:
        if node_id in visiting:
            errors.append(f"graph cycle at {node_id}")
            return
        if node_id in visited:
            return
        visiting.add(node_id)
        for dependency in by_id[node_id]["depends_on"]:
            if dependency in by_id:
                visit(dependency)
        visiting.remove(node_id)
        visited.add(node_id)

    for node_id in by_id:
        visit(node_id)
    return errors


def frontmatter_type(path: Path) -> str | None:
    lines = path.read_text(encoding="utf-8").splitlines()
    if not lines or lines[0].strip() != "---":
        return None
    for line in lines[1:]:
        if line.strip() == "---":
            break
        if line.startswith("type:"):
            return line.split(":", 1)[1].strip().strip("\"'") or None
    return None


def verify_bundle(root: Path) -> list[str]:
    errors: list[str] = []
    for required in ("index.md", "problem.md", "graph.json", "evidence.jsonl", "knowledge/index.md", "knowledge/log.md"):
        if not (root / required).is_file():
            errors.append(f"missing {required}")
    errors.extend(verify_graph(root / "graph.json"))
    errors.extend(verify_ledger(root / "evidence.jsonl"))
    for path in root.rglob("*.md"):
        if path.name in {"index.md", "log.md"}:
            continue
        try:
            kind = frontmatter_type(path)
        except (OSError, UnicodeError) as exc:
            errors.append(f"cannot read {path.relative_to(root)}: {exc}")
            continue
        if not kind:
            errors.append(f"missing type frontmatter: {path.relative_to(root)}")
        text = path.read_text(encoding="utf-8")
        for raw_target in MARKDOWN_LINK.findall(text):
            target = raw_target.strip().strip("<>").split("#", 1)[0]
            if not target or "://" in target or not target.endswith(".md"):
                continue
            if target.startswith("/"):
                errors.append(f"root-absolute Markdown link: {path.relative_to(root)} -> {raw_target}")
                continue
            resolved_target = (path.parent / target).resolve()
            if not resolved_target.is_relative_to(root.resolve()):
                errors.append(f"escaping Markdown link: {path.relative_to(root)} -> {raw_target}")
            elif not resolved_target.is_file():
                errors.append(f"broken Markdown link: {path.relative_to(root)} -> {raw_target}")
    graph_path = root / "graph.json"
    problem_path = root / "problem.md"
    if graph_path.is_file() and problem_path.is_file():
        try:
            graph = json.loads(graph_path.read_text(encoding="utf-8"))
            if graph.get("problem_sha256") != file_digest(problem_path):
                errors.append("graph problem_sha256 does not match problem.md")
        except (json.JSONDecodeError, OSError, UnicodeError):
            pass
    return errors


def initialize(root: Path, problem_path: Path, title: str) -> None:
    if root.exists():
        raise ReceiptError(f"run directory already exists: {root}")
    problem = problem_path.read_text(encoding="utf-8").strip()
    if not title:
        raise ReceiptError("title is empty")
    if not problem:
        raise ReceiptError("problem file is empty")
    root.mkdir(parents=True, mode=0o700)
    (root / "candidates").mkdir()
    (root / "knowledge").mkdir()
    now = timestamp()
    description = " ".join(problem.split())[:160]
    document = (
        "---\n"
        "type: problem\n"
        f"title: {json.dumps(title)}\n"
        f"description: {json.dumps(description)}\n"
        f"timestamp: {json.dumps(now)}\n"
        "status: active\n"
        "---\n\n"
        f"# {title}\n\n{problem}\n"
    )
    (root / "problem.md").write_text(document, encoding="utf-8")
    graph = {
        "schema_version": SCHEMA,
        "status": "draft",
        "problem_sha256": file_digest(root / "problem.md"),
        "budgets": {"max_seats": 5, "max_cycles": 1},
        "nodes": [],
    }
    (root / "graph.json").write_text(json.dumps(graph, indent=2) + "\n", encoding="utf-8")
    (root / "evidence.jsonl").touch(mode=0o600)
    (root / "index.md").write_text(
        f"# {title}\n\n- [Problem](problem.md)\n- [Agent graph](graph.json)\n- [Knowledge](knowledge/index.md)\n",
        encoding="utf-8",
    )
    (root / "knowledge" / "index.md").write_text(
        "# Knowledge\n\nCycle-boundary selection, strategy, and risk cards appear here.\n",
        encoding="utf-8",
    )
    (root / "knowledge" / "log.md").write_text(
        f"# Knowledge log\n\n## {now[:10]}\n\n- Initialized empty OKF memory.\n",
        encoding="utf-8",
    )


def parser() -> argparse.ArgumentParser:
    value = argparse.ArgumentParser(description=__doc__)
    commands = value.add_subparsers(dest="command", required=True)
    initialize_command = commands.add_parser("init")
    initialize_command.add_argument("run_dir", type=Path)
    initialize_command.add_argument("--problem", type=Path, required=True)
    initialize_command.add_argument("--title", required=True)
    append = commands.add_parser("append")
    append.add_argument("ledger", type=Path)
    append.add_argument("receipt", type=Path)
    verify = commands.add_parser("verify")
    verify.add_argument("run_dir", type=Path)
    hash_command = commands.add_parser("hash")
    hash_command.add_argument("file", type=Path)
    return value


def main(argv: list[str] | None = None) -> int:
    try:
        args = parser().parse_args(argv)
        if args.command == "init":
            initialize(args.run_dir.resolve(), args.problem.resolve(), args.title.strip())
            print(args.run_dir.resolve())
            return 0
        if args.command == "append":
            record = validate_record(json.loads(args.receipt.read_text(encoding="utf-8")))
            print(json.dumps(append_record(args.ledger.resolve(), record), indent=2, sort_keys=True))
            return 0
        if args.command == "hash":
            print(file_digest(args.file.resolve()))
            return 0
        errors = verify_bundle(args.run_dir.resolve())
        if errors:
            for error in errors:
                print(f"ERROR: {error}", file=sys.stderr)
            return 1
        print("OK")
        return 0
    except (ReceiptError, OSError, UnicodeError, json.JSONDecodeError) as exc:
        print(f"receipts: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
