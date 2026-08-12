#!/usr/bin/env python3
"""Run bounded GPT-only Codex seats from a JSONL manifest."""

from __future__ import annotations

import argparse
from datetime import UTC, datetime
import json
import os
from pathlib import Path
import re
import shutil
import signal
import subprocess
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed


SKILL_DIR = Path(__file__).resolve().parent.parent
CONFIG_FILE = SKILL_DIR / "fleet.yaml"
SEAT_ID = re.compile(r"[A-Za-z0-9][A-Za-z0-9._-]{0,63}")
GPT_MODEL = re.compile(r"gpt-[a-z0-9][a-z0-9.-]*")


class FleetError(ValueError):
    pass


def _load_value(path: Path) -> dict:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError) as exc:
        raise FleetError(f"cannot load Fleet config: {exc}") from exc
    if not isinstance(value, dict) or not value:
        raise FleetError("Fleet config must be a non-empty object")
    return value


def _validate_models(value: dict) -> dict[str, dict]:
    if not isinstance(value, dict) or not value:
        raise FleetError("model policy must be a non-empty object")
    for lane, policy in value.items():
        if not SEAT_ID.fullmatch(lane) or not isinstance(policy, dict):
            raise FleetError(f"invalid lane: {lane!r}")
        model = policy.get("model")
        effort = policy.get("effort")
        width = policy.get("max_concurrency")
        timeout = policy.get("timeout_seconds")
        if not isinstance(model, str) or not GPT_MODEL.fullmatch(model):
            raise FleetError(f"lane {lane!r} is not GPT-only")
        if not isinstance(effort, str) or not effort:
            raise FleetError(f"lane {lane!r} has no reasoning effort")
        if not isinstance(width, int) or not 1 <= width <= 5:
            raise FleetError(f"lane {lane!r} width must be 1..5")
        if not isinstance(timeout, int) or timeout < 30:
            raise FleetError(f"lane {lane!r} timeout must be at least 30 seconds")
    return value


def load_config(path: Path = CONFIG_FILE, preset: str | None = None) -> dict:
    value = _load_value(path)
    if set(value) != {"default_preset", "models", "presets"}:
        if preset is not None:
            raise FleetError("a legacy model policy does not define presets")
        return {"preset": None, "default_lane": None, "models": _validate_models(value)}

    models = _validate_models(value["models"])
    presets = value["presets"]
    default_preset = value["default_preset"]
    if not isinstance(presets, dict) or not presets:
        raise FleetError("Fleet config must define presets")
    if not isinstance(default_preset, str) or default_preset not in presets:
        raise FleetError("Fleet config has an unknown default preset")
    for name, policy in presets.items():
        if not SEAT_ID.fullmatch(name) or not isinstance(policy, dict) or set(policy) != {"default_lane"}:
            raise FleetError(f"invalid preset: {name!r}")
        if policy["default_lane"] not in models:
            raise FleetError(f"preset {name!r} has an unknown default lane")
    selected = preset or default_preset
    if selected not in presets:
        raise FleetError(f"unknown preset: {selected!r}")
    return {"preset": selected, "default_lane": presets[selected]["default_lane"], "models": models}


def load_models(path: Path = CONFIG_FILE) -> dict[str, dict]:
    return load_config(path)["models"]


def load_manifest(
    path: Path,
    models: dict[str, dict],
    workdir: Path | None = None,
    default_lane: str | None = None,
) -> list[dict]:
    seats: list[dict] = []
    seen: set[str] = set()
    prompt_root = (workdir or path.parent).resolve()
    try:
        lines = path.read_text(encoding="utf-8").splitlines()
    except (OSError, UnicodeError) as exc:
        raise FleetError(f"cannot read manifest: {exc}") from exc
    for number, line in enumerate(lines, 1):
        if not line.strip():
            continue
        try:
            row = json.loads(line)
        except json.JSONDecodeError as exc:
            raise FleetError(f"manifest row {number}: invalid JSON: {exc.msg}") from exc
        if not isinstance(row, dict) or set(row) not in ({"id", "prompt"}, {"id", "lane", "prompt"}):
            raise FleetError(f"manifest row {number}: expected id, prompt, and optional lane")
        seat_id, lane, prompt = row["id"], row.get("lane", default_lane), row["prompt"]
        if not isinstance(seat_id, str) or not SEAT_ID.fullmatch(seat_id):
            raise FleetError(f"manifest row {number}: invalid seat id")
        if seat_id in seen:
            raise FleetError(f"manifest row {number}: duplicate seat id {seat_id!r}")
        if lane is None:
            raise FleetError(f"manifest row {number}: lane is required without a preset default")
        if lane not in models:
            raise FleetError(f"manifest row {number}: unknown lane {lane!r}")
        if not isinstance(prompt, str) or not prompt.strip():
            raise FleetError(f"manifest row {number}: prompt must be a path")
        prompt_path = Path(prompt)
        if not prompt_path.is_absolute():
            prompt_path = path.parent / prompt_path
        prompt_path = prompt_path.resolve()
        if not prompt_path.is_relative_to(prompt_root):
            raise FleetError(f"manifest row {number}: prompt escapes workdir")
        if not prompt_path.is_file():
            raise FleetError(f"manifest row {number}: prompt not found: {prompt_path}")
        seats.append({"id": seat_id, "lane": lane, "prompt": prompt_path})
        seen.add(seat_id)
    if not seats:
        raise FleetError("manifest has no seats")
    return seats


def private_text(path: Path):
    descriptor = os.open(path, os.O_CREAT | os.O_TRUNC | os.O_WRONLY, 0o600)
    return os.fdopen(descriptor, "w", encoding="utf-8")


def atomic_json(path: Path, value: object) -> None:
    temporary = path.with_name(f".{path.name}.{os.getpid()}.{threading.get_ident()}.tmp")
    with private_text(temporary) as handle:
        json.dump(value, handle, indent=2, sort_keys=True)
        handle.write("\n")
        handle.flush()
        os.fsync(handle.fileno())
    os.replace(temporary, path)


def terminate(process: subprocess.Popen) -> None:
    try:
        os.killpg(process.pid, signal.SIGTERM)
        process.wait(timeout=5)
    except (ProcessLookupError, subprocess.TimeoutExpired):
        try:
            os.killpg(process.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass
        process.wait()


def run_seat(
    seat: dict,
    policy: dict,
    run_dir: Path,
    workdir: Path,
    sandbox: str,
    codex_bin: str,
) -> dict:
    seat_dir = run_dir / seat["id"]
    seat_dir.mkdir(mode=0o700)
    answer = seat_dir / "answer.md"
    events = seat_dir / "events.jsonl"
    errors = seat_dir / "stderr.log"
    status_path = seat_dir / "status.json"
    answer.touch(mode=0o600)
    prompt = seat["prompt"].read_text(encoding="utf-8")
    command = [
        codex_bin,
        "exec",
        "--ephemeral",
        "--json",
        "--model",
        policy["model"],
        "--config",
        f'model_reasoning_effort="{policy["effort"]}"',
        "--sandbox",
        sandbox,
        "--cd",
        str(workdir),
        "--output-last-message",
        str(answer),
        "-",
    ]
    started = time.monotonic()
    timed_out = False
    process: subprocess.Popen | None = None
    with private_text(events) as stdout, private_text(errors) as stderr:
        try:
            process = subprocess.Popen(
                command,
                stdin=subprocess.PIPE,
                stdout=stdout,
                stderr=stderr,
                text=True,
                start_new_session=True,
            )
            try:
                process.communicate(prompt, timeout=policy["timeout_seconds"])
            except subprocess.TimeoutExpired:
                timed_out = True
                terminate(process)
        except OSError as exc:
            stderr.write(f"{exc}\n")
    elapsed = round(time.monotonic() - started, 3)
    if process is None:
        status = "launch-error"
    elif timed_out:
        status = "timeout"
    elif process.returncode != 0:
        status = "failed"
    elif answer.stat().st_size == 0:
        status = "empty-output"
    else:
        status = "ok"
    result = {
        "id": seat["id"],
        "lane": seat["lane"],
        "model": policy["model"],
        "reasoning_effort": policy["effort"],
        "status": status,
        "exit_code": None if process is None else process.returncode,
        "elapsed_seconds": elapsed,
        "answer": str(answer),
        "events": str(events),
        "stderr": str(errors),
    }
    atomic_json(status_path, result)
    return result


def command_list(models: dict[str, dict], preset: str | None, default_lane: str | None) -> int:
    print(f"# preset={preset or 'custom'} default_lane={default_lane or 'explicit'}")
    print("lane\tmodel\teffort\twidth\ttimeout_seconds")
    for lane, policy in models.items():
        print(
            f"{lane}\t{policy['model']}\t{policy['effort']}\t"
            f"{policy['max_concurrency']}\t{policy['timeout_seconds']}"
        )
    return 0


def command_batch(
    args: argparse.Namespace,
    models: dict[str, dict],
    preset: str | None,
    default_lane: str | None,
) -> int:
    manifest = args.manifest.resolve()
    workdir = args.workdir.resolve()
    seats = load_manifest(manifest, models, workdir, default_lane)
    if not workdir.is_dir():
        raise FleetError(f"workdir not found: {workdir}")
    if args.dry_run:
        print(
            json.dumps(
                {
                    "preset": preset,
                    "default_lane": default_lane,
                    "sandbox": args.sandbox,
                    "width": min(args.width, len(seats)),
                    "seats": [
                        {"id": seat["id"], "lane": seat["lane"], "model": models[seat["lane"]]["model"]}
                        for seat in seats
                    ],
                },
                indent=2,
            )
        )
        return 0
    codex_bin = shutil.which(args.codex_bin) if os.sep not in args.codex_bin else args.codex_bin
    if not codex_bin or not Path(codex_bin).is_file():
        raise FleetError(f"codex executable not found: {args.codex_bin}")
    run_dir = (
        args.run_dir.resolve()
        if args.run_dir is not None
        else workdir / ".copernicus" / "runs" / f"{datetime.now(UTC).strftime('%Y%m%dT%H%M%SZ')}-{os.getpid()}"
    )
    run_dir.mkdir(parents=True, mode=0o700, exist_ok=False)
    semaphores = {
        lane: threading.Semaphore(policy["max_concurrency"])
        for lane, policy in models.items()
    }

    def guarded(seat: dict) -> dict:
        with semaphores[seat["lane"]]:
            return run_seat(
                seat,
                models[seat["lane"]],
                run_dir,
                workdir,
                args.sandbox,
                str(codex_bin),
            )

    results: list[dict | None] = [None] * len(seats)
    with ThreadPoolExecutor(max_workers=min(args.width, 5, len(seats))) as pool:
        futures = {pool.submit(guarded, seat): index for index, seat in enumerate(seats)}
        for future in as_completed(futures):
            results[futures[future]] = future.result()
    roster = [result for result in results if result is not None]
    atomic_json(run_dir / "roster.json", roster)
    print(json.dumps(roster, indent=2))
    return 0 if all(row["status"] == "ok" for row in roster) else 3


def parser() -> argparse.ArgumentParser:
    value = argparse.ArgumentParser(description=__doc__)
    subcommands = value.add_subparsers(dest="command", required=True)
    list_command = subcommands.add_parser("list", help="list the enforced GPT lanes")
    batch = subcommands.add_parser("batch", help="run a JSONL seat manifest")
    batch.add_argument("manifest", type=Path)
    batch.add_argument("--run-dir", type=Path)
    batch.add_argument("--workdir", type=Path, default=Path.cwd())
    batch.add_argument("--width", type=int, choices=range(1, 6), default=5)
    batch.add_argument("--sandbox", choices=("read-only", "workspace-write"), default="read-only")
    batch.add_argument("--codex-bin", default="codex")
    batch.add_argument("--dry-run", action="store_true")
    for command in (list_command, batch):
        command.add_argument("--config-file", "--models-file", dest="config_file", type=Path, default=CONFIG_FILE)
        command.add_argument("--preset")
    return value


def main(argv: list[str] | None = None) -> int:
    try:
        args = parser().parse_args(argv)
        config = load_config(args.config_file.resolve(), args.preset)
        if args.command == "list":
            return command_list(config["models"], config["preset"], config["default_lane"])
        return command_batch(args, config["models"], config["preset"], config["default_lane"])
    except (FleetError, OSError, UnicodeError) as exc:
        print(f"fleet: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
