---
name: fleet
description: Orchestrate bounded GPT-only Codex fleets across Sol, Terra, and Luna Max lanes. Use when a user asks for Fleet, parallel agents, deep multi-agent work, broad classification, independent verification, or a cron-friendly batch that must use ChatGPT-plan Codex authentication without third-party providers.
---

# Copernicus Fleet

Route each seat to the cheapest GPT lane that can meet a checkable contract. The lead owns decomposition, width, evidence, and synthesis; workers never create more workers.

Resolve `<fleet-skill-dir>` to the directory containing this `SKILL.md`. Resolve
all bundled scripts, references, and model policy files from that directory,
never from the user's current working directory.

Read [guide.md](references/guide.md) when explaining Fleet, choosing between an
interactive mission and a batch, designing a first mission, or changing this
skill. It describes the purpose, execution model, outputs, examples, privacy
boundary, and limitations.

Open a fleet mission with:

```text
Using Copernicus Fleet: GPT-only.
Mission: <one sentence>.
Execute vs validate: <what runs now>.
```

## Route

Read `fleet.yaml` before routing. It contains the GPT model bindings, named
presets, and the active `default_preset`. The shipped default is `terra-first`:
an omitted manifest lane resolves to Terra. Use `luna-breadth` when repeatable
width should be the default, or name any lane explicitly to override a preset.

- **Sol** (`gpt-5.6-sol`): ambiguous, high-value synthesis, architecture, and final verification. Use 3-4 seats only for an explicitly deep mission.
- **Terra** (`gpt-5.6-terra`): default everyday implementation, grounded review, mapping, and reducers.
- **Luna Max** (`gpt-5.6-luna`, `max`): clear, repeatable extraction, classification, and bounded shards. Run waves of at most five.

Read [model-policy.md](references/model-policy.md) before changing lane names,
presets, concurrency, model IDs, or reasoning efforts. If a configured model is
unavailable to the signed-in account, report it as unavailable; never fall back
to a non-GPT provider. For a different account catalog, copy `fleet.yaml`, bind
only observed GPT IDs, and pass the copy with `--config-file`.

## Execute

1. Run deterministic commands first. Do not spend a seat on a claim a test, parser, grep, or measurement can settle.
2. Give every seat a unique role, bounded material, allowed paths, edit policy, typed output, evidence standard, falsifier, and stop rule. State `Do not spawn subagents`.
3. Keep verification independent: an author does not certify its own result. Prefer a deterministic gate, then a fresh Terra or Sol review.
4. Launch only independent seats in parallel. Use Luna waves for breadth, then deduplicate before synthesis.
5. Treat timeout, quota, auth, and unavailable-model results as missing evidence, never as a vote.
6. Verify every load-bearing claim against source or a runnable check before persisting it.

Use Codex collaboration tools for interactive missions. For local scheduled or shell-driven batches, use the bundled runner:

```bash
python3 <fleet-skill-dir>/scripts/fleet.py list
python3 <fleet-skill-dir>/scripts/fleet.py list --preset luna-breadth
python3 <fleet-skill-dir>/scripts/fleet.py batch manifest.jsonl --run-dir .copernicus/runs/example --workdir . --dry-run
python3 <fleet-skill-dir>/scripts/fleet.py batch manifest.jsonl --run-dir .copernicus/runs/example --workdir .
```

Manifest rows contain `id`, `prompt`, and an optional `lane`. Omitting `lane`
uses the active preset's default; an explicit lane always wins:

```json
{"id":"review-api","prompt":"prompts/review-api.md"}
{"id":"map-api","lane":"luna","prompt":"prompts/map-api.md"}
```

The runner is read-only by default, invokes `codex exec` without a shell, clamps concurrency to lane limits, stores one private answer/events/status directory per seat, and returns nonzero if any seat fails. Use `--sandbox workspace-write` only for an explicitly authorized implementation batch. It never supports `danger-full-access`.

## Seat contract

```text
ROLE: <one bounded function>. Read-only unless exact writable paths follow. Do not spawn subagents.
GOAL: <user-visible destination>.
SUCCESS: <checkable result and verification>.
MATERIAL: <exact paths or evidence slice>.
CONSTRAINTS: GPT-only; no secrets; no destructive or external writes; cite evidence read.
OUTPUT: <schema or headings>.
FALSIFIER: <observation that disproves the claim>.
STOP: emit UNVERIFIED when evidence is missing; stop after the bounded result.
```

## Hard rules

- Use only model IDs beginning with `gpt-`; the runner enforces this again at execution.
- Use the user's existing Codex sign-in. Never read, copy, print, or commit auth caches, API keys, or tokens.
- Do not use provider proxies, OpenRouter, or third-party model fallbacks.
- Do not let workers deploy, purchase, sign, publish, message people, or mutate external systems without the user's explicit authorization.
- Do not create immortal agents. Durable state belongs in files, tests, receipts, or scheduled-task history.
- Do not count correlated Luna outputs as independent validation.

Keep seat provenance in the private run trace. In a normal conversational
response, lead with the verified outcome and omit the roster. Show a compact
roster only when the user requests execution provenance, or when a failed or
unavailable seat or material dissent changes confidence. Then give verified
claims, rejected or unverified claims, and useful next commands.

Fleet is self-contained: interactive work uses Codex's collaboration surface;
batch work uses the bundled Python standard-library runner and the user's
existing `codex` executable. It needs no provider proxy, API-key router,
database, daemon, or private project files.
