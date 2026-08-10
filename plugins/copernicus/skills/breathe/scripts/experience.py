#!/usr/bin/env python3
"""Record privacy-safe Breathe briefing feedback."""

from __future__ import annotations

import argparse
from collections import Counter, defaultdict
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import stat
import sys

try:
    import fcntl
except ImportError:  # pragma: no cover - Windows has no flock
    fcntl = None


VERSION = 1
MAX_BYTES = 1024 * 1024
SIGNALS = (
    "useful",
    "expanded",
    "not-useful",
    "too-detailed",
    "too-thin",
    "missed-decision",
    "wrong-priority",
)
SECTIONS = (
    "bottom-line",
    "decisions",
    "recommendation",
    "evidence",
    "risks",
    "uncertainty",
    "next-actions",
    "trace",
)


class ExperienceError(ValueError):
    pass


def experience_path() -> Path:
    override = os.environ.get("COPERNICUS_BREATHE_EXPERIENCE_FILE")
    if override:
        return Path(override).expanduser()
    state = os.environ.get("XDG_STATE_HOME")
    root = Path(state).expanduser() if state else Path.home() / ".local" / "state"
    return root / "copernicus" / "breathe" / "experience.jsonl"


def _flags(base: int) -> int:
    return base | getattr(os, "O_NOFOLLOW", 0)


def _validate_event(event: dict) -> None:
    if set(event) != {"version", "timestamp", "signal", "section"}:
        raise ExperienceError("invalid experience fields")
    if event["version"] != VERSION or event["signal"] not in SIGNALS or event["section"] not in SECTIONS:
        raise ExperienceError("invalid experience value")
    if not isinstance(event["timestamp"], str) or not event["timestamp"].endswith("Z"):
        raise ExperienceError("invalid experience timestamp")


def record(path: Path, signal: str, section: str) -> None:
    event = {
        "version": VERSION,
        "timestamp": datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z"),
        "signal": signal,
        "section": section,
    }
    _validate_event(event)
    if path.is_symlink():
        raise ExperienceError("experience file cannot be a symlink")
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    data = (json.dumps(event, separators=(",", ":")) + "\n").encode()
    fd = os.open(path, _flags(os.O_WRONLY | os.O_CREAT | os.O_APPEND), 0o600)
    try:
        if fcntl is not None:
            fcntl.flock(fd, fcntl.LOCK_EX)
        info = os.fstat(fd)
        if not stat.S_ISREG(info.st_mode):
            raise ExperienceError("experience path must be a regular file")
        if info.st_size + len(data) > MAX_BYTES:
            raise ExperienceError("experience file reached its 1 MiB limit")
        if hasattr(os, "fchmod"):
            os.fchmod(fd, 0o600)
        while data:
            data = data[os.write(fd, data) :]
        os.fsync(fd)
    finally:
        os.close(fd)


def load(path: Path) -> list[dict]:
    if path.is_symlink():
        raise ExperienceError("experience file cannot be a symlink")
    if not path.exists():
        return []
    fd = os.open(path, _flags(os.O_RDONLY))
    try:
        info = os.fstat(fd)
        if not stat.S_ISREG(info.st_mode) or info.st_size > MAX_BYTES:
            raise ExperienceError("invalid experience file")
        data = b""
        while len(data) <= MAX_BYTES:
            chunk = os.read(fd, min(65536, MAX_BYTES + 1 - len(data)))
            if not chunk:
                break
            data += chunk
        if len(data) > MAX_BYTES:
            raise ExperienceError("experience file reached its 1 MiB limit")
    finally:
        os.close(fd)

    try:
        lines = data.decode("utf-8").splitlines()
    except UnicodeDecodeError as error:
        raise ExperienceError("experience file is not UTF-8") from error

    events = []
    for line_number, line in enumerate(lines, 1):
        try:
            event = json.loads(line)
            _validate_event(event)
        except (json.JSONDecodeError, UnicodeDecodeError, ExperienceError) as error:
            raise ExperienceError(f"invalid experience row {line_number}: {error}") from error
        events.append(event)
    return events


def summarize(path: Path) -> dict:
    events = load(path)
    signal_counts = Counter(event["signal"] for event in events)
    section_signals: dict[str, Counter] = defaultdict(Counter)
    for event in events:
        section_signals[event["section"]][event["signal"]] += 1

    compression = "default"
    if len(events) >= 3:
        detailed = signal_counts["too-detailed"]
        thin = signal_counts["too-thin"]
        compression = "tighter" if detailed > thin else "fuller" if thin > detailed else "balanced"

    emphasize_score = lambda counts: counts["expanded"] + counts["too-thin"] + counts["missed-decision"] + counts["wrong-priority"]
    deemphasize_score = lambda counts: counts["not-useful"] + counts["too-detailed"]
    emphasize = sorted(
        (section for section, counts in section_signals.items() if emphasize_score(counts)),
        key=lambda section: (-emphasize_score(section_signals[section]), section),
    )[:3]
    deemphasize = sorted(
        (section for section, counts in section_signals.items() if deemphasize_score(counts)),
        key=lambda section: (-deemphasize_score(section_signals[section]), section),
    )[:3]

    return {
        "version": VERSION,
        "path": str(path),
        "sample_size": len(events),
        "signals": dict(sorted(signal_counts.items())),
        "section_signals": {section: dict(sorted(counts.items())) for section, counts in sorted(section_signals.items())},
        "hints": {
            "active": len(events) >= 3,
            "compression": compression,
            "emphasize": emphasize,
            "deemphasize": deemphasize,
        },
    }


def parser() -> argparse.ArgumentParser:
    root = argparse.ArgumentParser(description=__doc__)
    commands = root.add_subparsers(dest="command", required=True)
    record_command = commands.add_parser("record", help="append one explicit feedback signal")
    record_command.add_argument("--signal", required=True, choices=SIGNALS)
    record_command.add_argument("--section", required=True, choices=SECTIONS)
    commands.add_parser("summary", help="print aggregate preference hints as JSON")
    return root


def main(argv: list[str] | None = None) -> int:
    args = parser().parse_args(argv)
    path = experience_path()
    try:
        if args.command == "record":
            record(path, args.signal, args.section)
            print(json.dumps({"recorded": True, "path": str(path)}))
        elif args.command == "summary":
            print(json.dumps(summarize(path), indent=2, sort_keys=True))
        return 0
    except (ExperienceError, OSError) as error:
        print(f"breathe experience: {error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
