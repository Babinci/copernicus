---
type: runbook
title: Scheduled Copernicus work
description: Safely run bounded Copernicus research from ChatGPT Desktop Scheduled tasks or trusted local cron.
tags: [scheduled, cron, automation, safety]
timestamp: 2026-08-08T00:00:00+02:00
---

# Scheduled work

Prefer ChatGPT Desktop's **Scheduled** surface for local projects. It can invoke
skills directly, preserve run history, and isolate changes in a worktree. Keep
the computer on and the app running when the task needs local files.

Use a durable prompt:

```text
Use $auto-research for one bounded cycle on <problem file>. Run read-only in a
worktree. Maximum five seats and one cycle. Revalidate the problem regime, stop
on missing evidence or model access, write receipts and OKF proposals, and do not
promote memory or perform external actions. Report only material changes.
```

Test the prompt manually, inspect the first few runs, and raise cadence only when
outputs are stable and reviewable.

## Trusted local cron

Use cron only on a trusted local machine with an existing Codex login. Prevent
overlap with the platform's `flock`, keep the runner read-only, and give every run
a fresh directory:

```cron
17 3 * * * cd /absolute/project && install -d -m 700 .copernicus && flock -n .copernicus/cron.lock python3 /absolute/copernicus/plugins/copernicus/skills/fleet/scripts/fleet.py batch missions/daily.jsonl --workdir . >> .copernicus/cron.log 2>&1
```

Do not copy or commit `~/.codex/auth.json`; treat it like a password. Do not use
ChatGPT-managed account auth in public CI. For public GitHub Actions, follow the
official Codex Action guidance and keep credentials isolated from repository code.

## Stop conditions

A scheduled run stops on overlap, stale regime, invalid graph, broken evidence
chain, missing model, repeated failure signature, timeout, or exhausted budget.
Timeout is missing evidence, not a negative vote. There is no bundled daemon or
automatic retry loop.

Official references: [Scheduled tasks](https://learn.chatgpt.com/docs/automations),
[non-interactive mode](https://learn.chatgpt.com/docs/non-interactive-mode), and
[authentication](https://learn.chatgpt.com/docs/auth).
