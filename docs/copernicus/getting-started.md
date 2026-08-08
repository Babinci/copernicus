---
type: runbook
title: Getting started with Copernicus
description: Install the marketplace plugin, validate its GPT-only tools, and run a first SAS/OKF research cycle.
tags: [install, plugin, fleet, auto-research]
timestamp: 2026-08-08T00:00:00+02:00
---

# Getting started

## Install

Install Codex, sign in with ChatGPT, then add the public marketplace and plugin:

```bash
codex login
codex plugin marketplace add Babinci/copernicus
codex plugin add copernicus@copernicus
```

Restart the app if the skills do not appear. The plugin adds `$fleet`,
`$auto-research`, and `$rick-rubin`.

## Validate a checkout

```bash
python3 plugins/copernicus/skills/fleet/scripts/test_fleet.py
python3 plugins/copernicus/skills/auto-research/scripts/test_receipts.py
python3 plugins/copernicus/skills/fleet/scripts/fleet.py list
python3 plugins/copernicus/skills/auto-research/scripts/receipts.py --help
```

All Fleet model IDs are declared in one validated `models.json`. If an account
does not expose a declared model, copy the file, change only the available GPT
binding, and pass it with `--models-file`. Non-GPT IDs are rejected.

## First interactive mission

Ask:

```text
Use $rick-rubin to reduce these ideas to their essence. Then use
$auto-research on the strongest remaining problem. Keep the graph to five seats,
name the evaluator and falsifier, run read-only, and leave an OKF proposal bundle.
```

The expected result is a small role graph, a roster, supported and `UNVERIFIED`
claims, evaluator receipts, and proposed selection/strategy/risk cards. Review
the first cycle before accepting any durable memory.

## First CLI Fleet batch

Create `prompts/map.md` with a complete leaf-seat contract and `manifest.jsonl`:

```json
{"id":"map","lane":"luna","prompt":"prompts/map.md"}
{"id":"challenge","lane":"terra","prompt":"prompts/challenge.md"}
```

Validate without using plan capacity:

```bash
python3 plugins/copernicus/skills/fleet/scripts/fleet.py batch manifest.jsonl \
  --workdir . --run-dir .copernicus/runs/first --dry-run
```

Remove `--dry-run` only after the seat scopes, sandbox, and output contract are
correct. The default sandbox is read-only.
