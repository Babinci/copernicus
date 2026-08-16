#!/usr/bin/env python3
"""Inspect, traverse, validate, index, and migrate Google OKF bundles."""

from __future__ import annotations

import argparse
from collections import defaultdict, deque
from dataclasses import dataclass, field
from datetime import date, datetime
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import stat
import sys
import tempfile
from typing import Any, Iterable
from urllib.parse import unquote, urlsplit


VENDOR = Path(__file__).resolve().parent / "_vendor"
sys.path.insert(0, str(VENDOR))
import yaml  # type: ignore  # noqa: E402


INDEX_NAME = "index.md"
LOG_NAME = "log.md"
MARKER_START = "<!-- okf-docs:generated:start -->"
MARKER_END = "<!-- okf-docs:generated:end -->"
MAX_DOCUMENT_BYTES = 16 * 1024 * 1024
LINK_RE = re.compile(
    r"(?<!!)\[[^\]]*\]\((?P<target><[^>]+>|[^)\s]+)(?:\s+[\"'][^\"']*[\"'])?\)"
)
INDEX_ENTRY_RE = re.compile(r"^\s*[*+-]\s+\[[^\]]+\]\(([^)\s]+)\)")
TOP_TIMESTAMP_RE = re.compile(r"(?m)^timestamp:\s*(?P<value>[^\r\n]+?)\s*$")
VERSION_01_RE = re.compile(r"(?m)^okf_version:\s*[\"']?0\.1[\"']?\s*$")
ACTOR_RE = re.compile(r"^(?:human:[^\s]+|process:[^\s]+|[^\s/]+/[^\s/]+)$")


class StrictSafeLoader(yaml.SafeLoader):
    """SafeLoader that rejects aliases and duplicate mapping keys."""

    def compose_node(self, parent: Any, index: Any) -> Any:
        if self.check_event(yaml.AliasEvent):
            raise yaml.constructor.ConstructorError(
                None, None, "YAML aliases are not accepted", self.peek_event().start_mark
            )
        return super().compose_node(parent, index)


def _construct_mapping(loader: StrictSafeLoader, node: Any, deep: bool = False) -> dict[Any, Any]:
    loader.flatten_mapping(node)
    result: dict[Any, Any] = {}
    for key_node, value_node in node.value:
        key = loader.construct_object(key_node, deep=deep)
        try:
            duplicate = key in result
        except TypeError as exc:
            raise yaml.constructor.ConstructorError(
                "while constructing a mapping",
                node.start_mark,
                "found an unhashable key",
                key_node.start_mark,
            ) from exc
        if duplicate:
            raise yaml.constructor.ConstructorError(
                "while constructing a mapping",
                node.start_mark,
                f"found duplicate key {key!r}",
                key_node.start_mark,
            )
        result[key] = loader.construct_object(value_node, deep=deep)
    return result


StrictSafeLoader.add_constructor(
    yaml.resolver.BaseResolver.DEFAULT_MAPPING_TAG, _construct_mapping
)


def load_yaml(text: str) -> Any:
    return yaml.load(text, Loader=StrictSafeLoader)


def jsonable(value: Any) -> Any:
    if isinstance(value, dict):
        return {str(key): jsonable(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [jsonable(item) for item in value]
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    if isinstance(value, (str, int, float, bool)) or value is None:
        return value
    return str(value)


@dataclass(frozen=True)
class Finding:
    level: str
    code: str
    path: str
    detail: str

    def as_dict(self) -> dict[str, str]:
        return {
            "level": self.level,
            "code": self.code,
            "path": self.path,
            "detail": self.detail,
        }


@dataclass
class Document:
    root: Path
    path: Path
    relative: str
    id: str
    kind: str
    raw: bytes
    text: str
    metadata: dict[str, Any] = field(default_factory=dict)
    body: str = ""
    has_frontmatter: bool = False
    parse_error: str | None = None

    @property
    def sha256(self) -> str:
        return hashlib.sha256(self.raw).hexdigest()

    @property
    def type(self) -> str:
        return str(self.metadata.get("type") or "")

    @property
    def title(self) -> str:
        return str(self.metadata.get("title") or PurePosixPath(self.id).name)

    @property
    def description(self) -> str:
        return str(self.metadata.get("description") or "")

    @property
    def tags(self) -> list[str]:
        raw = self.metadata.get("tags") or []
        if not isinstance(raw, list):
            raw = [raw]
        return [str(item) for item in raw]

    @property
    def status(self) -> str:
        return str(self.metadata.get("status") or "stable")

    @property
    def trust(self) -> str:
        verified = self.metadata.get("verified")
        if isinstance(verified, dict):
            verified = [verified]
        if not isinstance(verified, list):
            return "unverified"
        actors = [str(item.get("by") or "") for item in verified if isinstance(item, dict)]
        if any(actor.startswith("human:") for actor in actors):
            return "human-reviewed"
        return "machine-confirmed" if any(actors) else "unverified"

    def stale(self, today: date) -> bool:
        raw = self.metadata.get("stale_after")
        if not raw:
            return False
        try:
            deadline = raw if isinstance(raw, date) else date.fromisoformat(str(raw)[:10])
        except ValueError:
            return False
        return today >= deadline

    def projection(self, today: date, *, include_metadata: bool = True) -> dict[str, Any]:
        result: dict[str, Any] = {
            "id": self.id,
            "path": self.relative,
            "kind": self.kind,
            "type": self.type,
            "title": self.title,
            "description": self.description,
            "tags": self.tags,
            "status": self.status,
            "trust": self.trust,
            "stale": self.stale(today),
            "bytes": len(self.raw),
            "sha256": self.sha256,
        }
        if include_metadata:
            result["metadata"] = jsonable(self.metadata)
        return result


@dataclass(frozen=True)
class Edge:
    source: str
    target: str
    kind: str
    raw: str
    internal: bool
    exists: bool | None

    def as_dict(self) -> dict[str, Any]:
        return {
            "source": self.source,
            "target": self.target,
            "kind": self.kind,
            "raw": self.raw,
            "internal": self.internal,
            "exists": self.exists,
        }


def document_id(relative: str) -> tuple[str, str]:
    path = PurePosixPath(relative)
    parent = "" if str(path.parent) == "." else path.parent.as_posix()
    if path.name == INDEX_NAME:
        return (f"{parent}/@index" if parent else "@index", "index")
    if path.name == LOG_NAME:
        return (f"{parent}/@log" if parent else "@log", "log")
    return (path.with_suffix("").as_posix(), "concept")


def parse_document(root: Path, path: Path, raw: bytes) -> Document:
    relative = path.relative_to(root).as_posix()
    doc_id, kind = document_id(relative)
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        return Document(root, path, relative, doc_id, kind, raw, "", parse_error=str(exc))
    doc = Document(root, path, relative, doc_id, kind, raw, text, body=text)
    lines = text.splitlines(keepends=True)
    if not lines or lines[0].strip() != "---":
        return doc
    end = next((index for index, line in enumerate(lines[1:], 1) if line.strip() == "---"), None)
    if end is None:
        doc.parse_error = "unterminated YAML frontmatter"
        return doc
    doc.has_frontmatter = True
    frontmatter = "".join(lines[1:end])
    doc.body = "".join(lines[end + 1 :]).lstrip("\r\n")
    try:
        metadata = load_yaml(frontmatter) or {}
    except yaml.YAMLError as exc:
        doc.parse_error = str(exc)
        return doc
    if not isinstance(metadata, dict):
        doc.parse_error = "frontmatter must be a YAML mapping"
        return doc
    doc.metadata = metadata
    return doc


class Bundle:
    def __init__(self, root: Path, *, today: date | None = None) -> None:
        self.root = root.resolve()
        self.today = today or date.today()
        self.documents: dict[str, Document] = {}
        self.findings: list[Finding] = []
        self.edges: list[Edge] = []

    @classmethod
    def load(cls, root: str | Path, *, today: date | None = None) -> "Bundle":
        bundle = cls(Path(root), today=today)
        if not bundle.root.is_dir():
            raise ValueError(f"bundle root is not a directory: {root}")
        bundle._walk()
        bundle._build_edges()
        return bundle

    @property
    def version(self) -> str:
        index = self.documents.get("@index")
        return str(index.metadata.get("okf_version") or "unspecified") if index else "unspecified"

    @property
    def fingerprint(self) -> str:
        digest = hashlib.sha256()
        for doc in sorted(self.documents.values(), key=lambda item: item.relative):
            digest.update(doc.relative.encode())
            digest.update(b"\0")
            digest.update(doc.sha256.encode())
            digest.update(b"\n")
        return digest.hexdigest()

    def _walk(self) -> None:
        for directory, dirnames, filenames in os.walk(self.root, followlinks=False):
            directory_path = Path(directory)
            retained_dirs: list[str] = []
            for name in sorted(dirnames):
                candidate = directory_path / name
                if candidate.is_symlink():
                    self._warn("symlink-refused", candidate, "directory symlink was not traversed")
                else:
                    retained_dirs.append(name)
            dirnames[:] = retained_dirs
            for name in sorted(filenames):
                if not name.endswith(".md"):
                    continue
                path = directory_path / name
                try:
                    info = path.lstat()
                except OSError as exc:
                    self._warn("unreadable", path, str(exc))
                    continue
                if stat.S_ISLNK(info.st_mode):
                    self._warn("symlink-refused", path, "file symlink was not read")
                    continue
                if not stat.S_ISREG(info.st_mode):
                    self._warn("non-regular-refused", path, "only regular Markdown files are read")
                    continue
                if info.st_nlink > 1:
                    self._warn("hardlink-refused", path, "hard-linked file was not read")
                    continue
                if info.st_size > MAX_DOCUMENT_BYTES:
                    self._warn("document-too-large", path, f"exceeds {MAX_DOCUMENT_BYTES} bytes")
                    continue
                try:
                    raw = path.read_bytes()
                except OSError as exc:
                    self._warn("unreadable", path, str(exc))
                    continue
                doc = parse_document(self.root, path, raw)
                self.documents[doc.id] = doc

    def _warn(self, code: str, path: Path, detail: str) -> None:
        try:
            relative = path.relative_to(self.root).as_posix()
        except ValueError:
            relative = str(path)
        self.findings.append(Finding("warning", code, relative, detail))

    def _resolve(self, source: Document, raw_target: Any) -> tuple[str, bool, bool | None]:
        target = str(raw_target or "").strip()
        if target.startswith("<") and target.endswith(">"):
            target = target[1:-1]
        target = unquote(target).split("#", 1)[0]
        if not target:
            return (str(raw_target), False, None)
        split = urlsplit(target)
        if split.scheme or target.startswith("//"):
            return (target, False, None)
        looks_pathlike = (
            target.startswith(("/", "./", "../"))
            or target.endswith((".md", "/"))
            or "/" in target
        )
        if not looks_pathlike:
            return (target, False, None)
        if target.startswith("/"):
            relative = PurePosixPath(target.lstrip("/"))
        else:
            parent = PurePosixPath(source.relative).parent
            relative = parent / target
        parts: list[str] = []
        for part in relative.parts:
            if part in ("", "."):
                continue
            if part == "..":
                if not parts:
                    return (target, False, None)
                parts.pop()
            else:
                parts.append(part)
        if not parts:
            return ("@index", True, "@index" in self.documents)
        normalized = PurePosixPath(*parts)
        if target.endswith("/"):
            doc_id = normalized.as_posix().rstrip("/") + "/@index"
        else:
            doc_id, _ = document_id(normalized.as_posix())
        return (doc_id, True, doc_id in self.documents)

    def _add_edge(self, source: Document, target: Any, kind: str) -> None:
        if target in (None, ""):
            return
        resolved, internal, exists = self._resolve(source, target)
        self.edges.append(Edge(source.id, resolved, kind, str(target), internal, exists))

    def _build_edges(self) -> None:
        for doc in self.documents.values():
            for match in LINK_RE.finditer(doc.body):
                self._add_edge(doc, match.group("target"), "link")
            if doc.kind == "index":
                for line in doc.body.splitlines():
                    match = INDEX_ENTRY_RE.match(line)
                    if match:
                        self._add_edge(doc, match.group(1), "index")
            if doc.kind != "concept" or doc.parse_error:
                continue
            self._add_edge(doc, doc.metadata.get("resource"), "resource")
            sources = doc.metadata.get("sources") or []
            if isinstance(sources, dict):
                sources = [sources]
            if isinstance(sources, list):
                for source in sources:
                    if isinstance(source, dict):
                        self._add_edge(doc, source.get("resource"), "source")
            self._add_edge(doc, doc.metadata.get("computation"), "computation")
            for key in ("executor", "attester"):
                value = doc.metadata.get(key)
                if isinstance(value, dict):
                    self._add_edge(doc, value.get("resource"), key)

        by_directory: dict[str, list[Document]] = defaultdict(list)
        for doc in self.documents.values():
            parent = str(PurePosixPath(doc.relative).parent)
            by_directory["" if parent == "." else parent].append(doc)
        for directory, docs in by_directory.items():
            index_id = f"{directory}/@index" if directory else "@index"
            index = self.documents.get(index_id)
            if not index:
                continue
            for doc in docs:
                if doc.id != index_id and doc.kind in ("concept", "log"):
                    self.edges.append(Edge(index.id, doc.id, "hierarchy", doc.relative, True, True))
            prefix = directory + "/" if directory else ""
            children = {
                doc.id.split("/@index", 1)[0]
                for doc in self.documents.values()
                if doc.kind == "index"
                and doc.id != index_id
                and doc.id.startswith(prefix)
                and "/" not in doc.id[len(prefix) :].split("/@index", 1)[0]
            }
            for child in children:
                self.edges.append(
                    Edge(index.id, f"{child}/@index", "hierarchy", child + "/", True, True)
                )
        unique = {(e.source, e.target, e.kind, e.raw, e.internal, e.exists): e for e in self.edges}
        self.edges = sorted(
            unique.values(), key=lambda e: (e.source, e.target, e.kind, e.raw)
        )

    def validate(self) -> list[Finding]:
        findings = list(self.findings)
        directories: set[str] = set()
        for doc in self.documents.values():
            parent = str(PurePosixPath(doc.relative).parent)
            directories.add("" if parent == "." else parent)
            if doc.parse_error:
                findings.append(Finding("error", "invalid-frontmatter", doc.relative, doc.parse_error))
                continue
            if doc.kind == "concept":
                if not doc.has_frontmatter:
                    findings.append(
                        Finding("error", "missing-frontmatter", doc.relative, "concept requires YAML frontmatter")
                    )
                elif not str(doc.metadata.get("type") or "").strip():
                    findings.append(Finding("error", "missing-type", doc.relative, "type is required"))
                if doc.status not in ("draft", "stable", "deprecated"):
                    findings.append(
                        Finding("warning", "unknown-status", doc.relative, f"status is {doc.status!r}")
                    )
                stale_after = doc.metadata.get("stale_after")
                if stale_after:
                    try:
                        date.fromisoformat(str(stale_after)[:10])
                    except ValueError:
                        findings.append(
                            Finding("warning", "invalid-stale-after", doc.relative, "expected YYYY-MM-DD")
                        )
                if doc.type == "Attested Computation" and not doc.metadata.get("runtime"):
                    findings.append(
                        Finding("warning", "missing-runtime", doc.relative, "Attested Computation should declare runtime")
                    )
            elif doc.kind == "index":
                if doc.id != "@index" and doc.has_frontmatter:
                    findings.append(
                        Finding("error", "index-frontmatter", doc.relative, "only root index.md may have frontmatter")
                    )
                if doc.id == "@index" and set(doc.metadata) - {"okf_version"}:
                    findings.append(
                        Finding("error", "index-frontmatter", doc.relative, "root index may declare only okf_version")
                    )
            elif doc.kind == "log" and doc.has_frontmatter:
                findings.append(Finding("error", "log-frontmatter", doc.relative, "log.md has no frontmatter"))
            if doc.kind == "log":
                for line in doc.body.splitlines():
                    if line.startswith("## ") and not re.fullmatch(r"## \d{4}-\d{2}-\d{2}", line):
                        findings.append(
                            Finding("error", "invalid-log-date", doc.relative, line.removeprefix("## "))
                        )
        for directory in directories:
            index_id = f"{directory}/@index" if directory else "@index"
            if index_id not in self.documents:
                path = f"{directory}/index.md" if directory else INDEX_NAME
                findings.append(Finding("warning", "missing-index", path, "index is optional but aids traversal"))
        for edge in self.edges:
            if edge.internal and edge.exists is False:
                source = self.documents.get(edge.source)
                findings.append(
                    Finding(
                        "warning",
                        "broken-link",
                        source.relative if source else edge.source,
                        f"{edge.kind} target {edge.raw!r} does not exist",
                    )
                )
        return sorted(findings, key=lambda item: (item.level, item.path, item.code, item.detail))

    def as_dict(self) -> dict[str, Any]:
        return {
            "root": str(self.root),
            "okf_version": self.version,
            "fingerprint": self.fingerprint,
            "documents": [
                doc.projection(self.today)
                for doc in sorted(self.documents.values(), key=lambda item: item.id)
            ],
            "edges": [edge.as_dict() for edge in self.edges],
            "findings": [finding.as_dict() for finding in self.validate()],
        }

    def adjacency(self, direction: str = "out") -> dict[str, list[tuple[str, Edge]]]:
        result: dict[str, list[tuple[str, Edge]]] = defaultdict(list)
        for edge in self.edges:
            if not edge.internal or not edge.exists:
                continue
            if direction in ("out", "both"):
                result[edge.source].append((edge.target, edge))
            if direction in ("in", "both"):
                result[edge.target].append((edge.source, edge))
        for edges in result.values():
            edges.sort(key=lambda item: (item[0], item[1].kind, item[1].source))
        return result

    def traverse(
        self, seeds: Iterable[str], *, direction: str, depth: int | None
    ) -> tuple[list[str], dict[str, tuple[str, Edge] | None]]:
        adjacency = self.adjacency(direction)
        queue: deque[tuple[str, int]] = deque()
        parents: dict[str, tuple[str, Edge] | None] = {}
        for seed in seeds:
            if seed not in self.documents:
                raise ValueError(f"unknown concept id: {seed}")
            if seed not in parents:
                parents[seed] = None
                queue.append((seed, 0))
        order: list[str] = []
        while queue:
            current, current_depth = queue.popleft()
            order.append(current)
            if depth is not None and current_depth >= depth:
                continue
            for target, edge in adjacency.get(current, []):
                if target in parents:
                    continue
                parents[target] = (current, edge)
                queue.append((target, current_depth + 1))
        return order, parents

    def shortest_path(self, source: str, target: str, *, direction: str) -> list[str] | None:
        order, parents = self.traverse([source], direction=direction, depth=None)
        if target not in parents:
            return None
        path = [target]
        while parents[path[-1]] is not None:
            path.append(parents[path[-1]][0])  # type: ignore[index]
        path.reverse()
        return path


def parse_today(value: str | None) -> date | None:
    return date.fromisoformat(value) if value else None


def load_bundle(args: argparse.Namespace) -> Bundle:
    return Bundle.load(args.root, today=parse_today(getattr(args, "today", None)))


def print_json(value: Any) -> None:
    print(json.dumps(jsonable(value), indent=2, sort_keys=True, ensure_ascii=False))


def projection_list(bundle: Bundle, ids: Iterable[str]) -> list[dict[str, Any]]:
    return [bundle.documents[item].projection(bundle.today) for item in ids]


def command_scan(args: argparse.Namespace) -> int:
    bundle = load_bundle(args)
    if args.format == "jsonl":
        print(json.dumps({"record": "bundle", "okf_version": bundle.version, "fingerprint": bundle.fingerprint}))
        for doc in sorted(bundle.documents.values(), key=lambda item: item.id):
            print(json.dumps({"record": "document", **jsonable(doc.projection(bundle.today))}, ensure_ascii=False))
        for edge in bundle.edges:
            print(json.dumps({"record": "edge", **edge.as_dict()}, ensure_ascii=False))
        for finding in bundle.validate():
            print(json.dumps({"record": "finding", **finding.as_dict()}, ensure_ascii=False))
    else:
        print_json(bundle.as_dict())
    return 0


def command_validate(args: argparse.Namespace) -> int:
    bundle = load_bundle(args)
    findings = bundle.validate()
    errors = sum(item.level == "error" for item in findings)
    print_json(
        {
            "ok": errors == 0,
            "errors": errors,
            "warnings": sum(item.level == "warning" for item in findings),
            "findings": [item.as_dict() for item in findings],
        }
    )
    return 1 if errors else 0


def nested_values(value: Any, parts: list[str]) -> list[Any]:
    if isinstance(value, list):
        return [item for child in value for item in nested_values(child, parts)]
    if not parts:
        return [value]
    if not isinstance(value, dict) or parts[0] not in value:
        return []
    return nested_values(value[parts[0]], parts[1:])


def parse_where(expression: str) -> tuple[list[str], Any]:
    if "=" not in expression:
        raise ValueError(f"--where requires key=value: {expression}")
    key, raw = expression.split("=", 1)
    return key.split("."), load_yaml(raw)


def command_query(args: argparse.Namespace) -> int:
    bundle = load_bundle(args)
    filters = [parse_where(item) for item in args.where]
    matches: list[Document] = []
    for doc in sorted(bundle.documents.values(), key=lambda item: item.id):
        envelope = {
            **doc.metadata,
            "id": doc.id,
            "path": doc.relative,
            "kind": doc.kind,
            "trust": doc.trust,
            "stale": doc.stale(bundle.today),
        }
        if any(expected not in nested_values(envelope, parts) for parts, expected in filters):
            continue
        if args.contains and args.contains.casefold() not in (doc.title + "\n" + doc.description + "\n" + doc.body).casefold():
            continue
        matches.append(doc)
        if len(matches) >= args.limit:
            break
    print_json({"documents": [doc.projection(bundle.today) for doc in matches], "count": len(matches)})
    return 0


def command_neighbors(args: argparse.Namespace) -> int:
    bundle = load_bundle(args)
    order, _ = bundle.traverse([args.id], direction=args.direction, depth=args.depth)
    selected = order[1:]
    selected_set = set(order)
    print_json(
        {
            "root": args.id,
            "documents": projection_list(bundle, selected),
            "edges": [
                edge.as_dict()
                for edge in bundle.edges
                if edge.source in selected_set and edge.target in selected_set
            ],
        }
    )
    return 0


def command_path(args: argparse.Namespace) -> int:
    bundle = load_bundle(args)
    path = bundle.shortest_path(args.source, args.target, direction=args.direction)
    print_json({"source": args.source, "target": args.target, "path": path})
    return 0 if path else 1


def command_impact(args: argparse.Namespace) -> int:
    bundle = load_bundle(args)
    order, _ = bundle.traverse([args.id], direction="in", depth=args.depth)
    print_json({"root": args.id, "documents": projection_list(bundle, order[1:])})
    return 0


def route_for(target: str, parents: dict[str, tuple[str, Edge] | None]) -> list[dict[str, Any]]:
    route: list[dict[str, Any]] = []
    current = target
    while parents[current] is not None:
        previous, edge = parents[current]  # type: ignore[misc]
        route.append(edge.as_dict())
        current = previous
    route.reverse()
    return route


def command_context(args: argparse.Namespace) -> int:
    bundle = load_bundle(args)
    order, parents = bundle.traverse(args.seed, direction=args.direction, depth=None)
    selected: list[dict[str, Any]] = []
    used_bytes = 0
    for doc_id in order:
        doc = bundle.documents[doc_id]
        if len(selected) >= args.max_docs:
            break
        if selected and used_bytes + len(doc.raw) > args.max_bytes:
            continue
        item = doc.projection(bundle.today, include_metadata=True)
        item["route"] = route_for(doc_id, parents)
        if args.include_body:
            item["body"] = doc.body
        selected.append(item)
        used_bytes += len(doc.raw)
    print_json(
        {
            "documents": selected,
            "bytes": used_bytes,
            "omitted_count": len(bundle.documents) - len(selected),
            "bundle_fingerprint": bundle.fingerprint,
        }
    )
    return 0


def command_health(args: argparse.Namespace) -> int:
    bundle = load_bundle(args)
    findings = bundle.validate()
    concepts = [doc for doc in bundle.documents.values() if doc.kind == "concept"]
    linked = {
        endpoint
        for edge in bundle.edges
        if edge.internal and edge.exists and edge.kind not in ("hierarchy",)
        for endpoint in (edge.source, edge.target)
    }
    print_json(
        {
            "okf_version": bundle.version,
            "concepts": len(concepts),
            "edges": len(bundle.edges),
            "types": dict(sorted(_counts(doc.type or "Unknown" for doc in concepts).items())),
            "trust": dict(sorted(_counts(doc.trust for doc in concepts).items())),
            "status": dict(sorted(_counts(doc.status for doc in concepts).items())),
            "stale": sorted(doc.id for doc in concepts if doc.stale(bundle.today)),
            "unlinked": sorted(doc.id for doc in concepts if doc.id not in linked),
            "errors": [item.as_dict() for item in findings if item.level == "error"],
            "warnings": [item.as_dict() for item in findings if item.level == "warning"],
        }
    )
    return 0


def _counts(values: Iterable[str]) -> dict[str, int]:
    result: dict[str, int] = defaultdict(int)
    for value in values:
        result[value] += 1
    return dict(result)


def generated_index_block(bundle: Bundle, directory: str) -> str:
    direct: list[Document] = []
    subdirs: dict[str, Document | None] = {}
    prefix = directory + "/" if directory else ""
    for doc in bundle.documents.values():
        relative = doc.relative
        if not relative.startswith(prefix):
            continue
        remainder = relative[len(prefix) :]
        if "/" not in remainder and doc.kind == "concept":
            direct.append(doc)
        elif "/" in remainder:
            child = remainder.split("/", 1)[0]
            child_index = bundle.documents.get(f"{prefix}{child}/@index")
            subdirs[child] = child_index
    lines = [MARKER_START]
    if subdirs:
        lines.extend(["", "# Directories", ""])
        for name in sorted(subdirs, key=str.casefold):
            index = subdirs[name]
            description = index.description if index else ""
            suffix = f" - {description}" if description else ""
            lines.append(f"* [{name}]({name}/){suffix}")
    grouped: dict[str, list[Document]] = defaultdict(list)
    for doc in direct:
        grouped[doc.type or "Unknown"].append(doc)
    for type_name in sorted(grouped, key=str.casefold):
        lines.extend(["", f"# {type_name}", ""])
        for doc in sorted(grouped[type_name], key=lambda item: (item.title.casefold(), item.relative)):
            suffix = f" - {doc.description}" if doc.description else ""
            lines.append(f"* [{doc.title}]({PurePosixPath(doc.relative).name}){suffix}")
    lines.extend(["", MARKER_END])
    return "\n".join(lines) + "\n"


def replace_marker(current: str, block: str, *, adopt: bool) -> tuple[str | None, str]:
    starts = current.count(MARKER_START)
    ends = current.count(MARKER_END)
    if starts == 1 and ends == 1 and current.index(MARKER_START) < current.index(MARKER_END):
        pattern = re.compile(re.escape(MARKER_START) + r".*?" + re.escape(MARKER_END) + r"\n?", re.S)
        return pattern.sub(block, current, count=1), "update"
    if starts or ends:
        return None, "refuse"
    if not adopt:
        return None, "refuse"
    separator = "" if not current or current.endswith("\n\n") else ("\n" if current.endswith("\n") else "\n\n")
    return current + separator + block, "adopt"


def atomic_write(path: Path, content: str) -> None:
    if path.exists() or path.is_symlink():
        info = path.lstat()
        if stat.S_ISLNK(info.st_mode) or not stat.S_ISREG(info.st_mode) or info.st_nlink > 1:
            raise ValueError(f"refusing unsafe write target: {path}")
        mode = stat.S_IMODE(info.st_mode)
    else:
        mode = 0o644
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary = tempfile.mkstemp(prefix=f".{path.name}.", dir=path.parent)
    try:
        with os.fdopen(descriptor, "wb") as handle:
            handle.write(content.encode("utf-8"))
            handle.flush()
            os.fsync(handle.fileno())
        os.chmod(temporary, mode)
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def command_index(args: argparse.Namespace) -> int:
    bundle = load_bundle(args)
    directories = {
        "" if str(PurePosixPath(doc.relative).parent) == "." else str(PurePosixPath(doc.relative).parent)
        for doc in bundle.documents.values()
        if doc.kind == "concept"
    }
    changes: list[dict[str, Any]] = []
    writes: list[tuple[Path, str]] = []
    for directory in sorted(directories):
        relative = f"{directory}/index.md" if directory else INDEX_NAME
        path = bundle.root / relative
        block = generated_index_block(bundle, directory)
        if not path.exists() and not path.is_symlink():
            prefix = '---\nokf_version: "0.2"\n---\n\n' if not directory else ""
            proposed, action = prefix + block, "create"
        else:
            info = path.lstat()
            if (
                stat.S_ISLNK(info.st_mode)
                or not stat.S_ISREG(info.st_mode)
                or info.st_nlink > 1
                or info.st_size > MAX_DOCUMENT_BYTES
            ):
                changes.append({"path": relative, "action": "refuse"})
                continue
            try:
                current = path.read_text(encoding="utf-8")
            except (OSError, UnicodeError):
                changes.append({"path": relative, "action": "refuse"})
                continue
            proposed, action = replace_marker(current, block, adopt=args.adopt)
            if proposed == current:
                continue
        change = {"path": relative, "action": action}
        if proposed is not None:
            change["sha256"] = hashlib.sha256(proposed.encode()).hexdigest()
            writes.append((path, proposed))
        changes.append(change)
    refused = any(item["action"] == "refuse" for item in changes)
    if args.write and not refused:
        for path, content in writes:
            atomic_write(path, content)
    print_json({"written": len(writes) if args.write and not refused else 0, "changes": changes})
    return 2 if args.write and refused else 0


def split_frontmatter(text: str) -> tuple[str, str] | None:
    lines = text.splitlines(keepends=True)
    if not lines or lines[0].strip() != "---":
        return None
    end = next((index for index, line in enumerate(lines[1:], 1) if line.strip() == "---"), None)
    if end is None:
        return None
    return ("".join(lines[: end + 1]), "".join(lines[end + 1 :]))


def command_migrate(args: argparse.Namespace) -> int:
    if not ACTOR_RE.fullmatch(args.actor):
        raise ValueError("actor must be human:<id>, process:<id>, or <producer>/<version>")
    bundle = load_bundle(args)
    changes: list[dict[str, Any]] = []
    writes: list[tuple[Path, str]] = []
    for doc in sorted(bundle.documents.values(), key=lambda item: item.relative):
        split = split_frontmatter(doc.text)
        if not split:
            continue
        frontmatter, body = split
        proposed_frontmatter = frontmatter
        reasons: list[str] = []
        if doc.id == "@index" and VERSION_01_RE.search(proposed_frontmatter):
            proposed_frontmatter = VERSION_01_RE.sub('okf_version: "0.2"', proposed_frontmatter, count=1)
            reasons.append("okf-version")
        if doc.kind == "concept" and "generated" not in doc.metadata:
            matches = list(TOP_TIMESTAMP_RE.finditer(proposed_frontmatter))
            if len(matches) == 1:
                raw_value = matches[0].group("value")
                replacement = f'generated: {{ by: {json.dumps(args.actor)}, at: {raw_value} }}'
                proposed_frontmatter = TOP_TIMESTAMP_RE.sub(replacement, proposed_frontmatter, count=1)
                reasons.append("timestamp-to-generated")
        proposed = proposed_frontmatter + body
        if proposed == doc.text:
            continue
        changes.append(
            {
                "path": doc.relative,
                "action": "update",
                "reasons": reasons,
                "before_sha256": doc.sha256,
                "after_sha256": hashlib.sha256(proposed.encode()).hexdigest(),
            }
        )
        writes.append((doc.path, proposed))
    if args.write:
        for path, content in writes:
            atomic_write(path, content)
    print_json({"written": len(writes) if args.write else 0, "changes": changes})
    return 0


def parser() -> argparse.ArgumentParser:
    result = argparse.ArgumentParser(description=__doc__)
    commands = result.add_subparsers(dest="command", required=True)

    def add_root(command: str, help_text: str) -> argparse.ArgumentParser:
        item = commands.add_parser(command, help=help_text)
        item.add_argument("root")
        item.add_argument("--today", help="YYYY-MM-DD freshness boundary")
        return item

    scan = add_root("scan", "emit a deterministic bundle graph")
    scan.add_argument("--format", choices=("json", "jsonl"), default="json")
    scan.set_defaults(handler=command_scan)

    validate = add_root("validate", "check OKF v0.2 conformance")
    validate.set_defaults(handler=command_validate)

    query = add_root("query", "filter complete YAML metadata and content")
    query.add_argument("--where", action="append", default=[], metavar="KEY=VALUE")
    query.add_argument("--contains")
    query.add_argument("--limit", type=int, default=100)
    query.set_defaults(handler=command_query)

    neighbors = add_root("neighbors", "traverse a bounded graph neighborhood")
    neighbors.add_argument("id")
    neighbors.add_argument("--direction", choices=("out", "in", "both"), default="both")
    neighbors.add_argument("--depth", type=int, default=1)
    neighbors.set_defaults(handler=command_neighbors)

    path_command = add_root("path", "find a shortest structural route")
    path_command.add_argument("source")
    path_command.add_argument("target")
    path_command.add_argument("--direction", choices=("out", "both"), default="out")
    path_command.set_defaults(handler=command_path)

    impact = add_root("impact", "find reverse dependents and backlinks")
    impact.add_argument("id")
    impact.add_argument("--depth", type=int)
    impact.set_defaults(handler=command_impact)

    context = add_root("context", "select a budgeted evidence manifest")
    context.add_argument("--seed", action="append", required=True)
    context.add_argument("--direction", choices=("out", "in", "both"), default="both")
    context.add_argument("--max-docs", type=int, default=30)
    context.add_argument("--max-bytes", type=int, default=250_000)
    context.add_argument("--include-body", action="store_true")
    context.set_defaults(handler=command_context)

    health = add_root("health", "summarize conformance, trust, freshness, and connectivity")
    health.set_defaults(handler=command_health)

    index = add_root("index", "plan or write marker-owned progressive indexes")
    index.add_argument("--write", action="store_true")
    index.add_argument("--adopt", action="store_true", help="append a generated region to curated indexes")
    index.set_defaults(handler=command_index)

    migrate = add_root("migrate", "plan or apply a byte-preserving v0.1 to v0.2 migration")
    migrate.add_argument("--actor", required=True)
    migrate.add_argument("--write", action="store_true")
    migrate.set_defaults(handler=command_migrate)
    return result


def main(argv: list[str] | None = None) -> int:
    args = parser().parse_args(argv)
    try:
        return int(args.handler(args))
    except (OSError, ValueError, yaml.YAMLError) as exc:
        print(json.dumps({"error": str(exc)}, ensure_ascii=False), file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
