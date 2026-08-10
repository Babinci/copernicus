---
type: runbook
title: Getting started with Copernicus
description: Install the marketplace plugin, validate its GPT-only tools, and run a first deep brief or SAS/OKF research cycle.
tags: [install, plugin, fleet, breathe, auto-research, html-report]
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

Restart the app if the skills do not appear. The plugin adds `$grill-me`,
`$rick-rubin`, `$fleet`, `$breathe`, `$auto-research`, `$html-report`,
`$caveman`, and `$handoff`.

Confirm installation with:

```bash
codex plugin list
```

In the app, open `/plugins`, select **Copernicus**, and inspect the eight bundled
skills. Start a new task so Codex loads their current instructions. One plugin
installation supplies all skills; no separate provider, database, daemon, or
credential setup is required.

Read [Skills](skills.md) for the full why, what, execution model, outputs,
examples, privacy boundary, and limitations.

## Validate a checkout

```bash
python3 plugins/copernicus/skills/fleet/scripts/test_fleet.py
python3 plugins/copernicus/skills/breathe/scripts/test_experience.py
python3 plugins/copernicus/skills/auto-research/scripts/test_receipts.py
python3 plugins/copernicus/skills/html-report/scripts/test_report.py
python3 plugins/copernicus/skills/fleet/scripts/fleet.py list
python3 plugins/copernicus/skills/breathe/scripts/experience.py summary
python3 plugins/copernicus/skills/auto-research/scripts/receipts.py --help
python3 plugins/copernicus/skills/html-report/scripts/report.py --help
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

## First Breathe mission

Ask:

```text
Use $breathe to investigate this architecture decision deeply. Use at most
three five-seat Luna map waves, stop when coverage closes, and interrupt me
only for a decision that changes scope or risk. Return a decision-complete
brief under 350 words with expandable evidence handles.
```

Breathe reuses Fleet for execution, verifies load-bearing claims, and puts the
decision before the compact trace. Its optional experience ledger stores only
explicit feedback categories, never project or conversation content.

## First human-facing report

Ask:

```text
Use $html-report to make a standalone decision report from this evaluated
evidence. Keep facts, inferences, and unknowns separate; add a falsifier for the
recommendation; use a diagram only if it clarifies a relationship.
```

The report is a derived reader artifact. It does not replace the evaluator or
write OKF memory.

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
