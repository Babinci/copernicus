# Copernicus Fleet explained

## Why it exists

A single agent is often asked to explore, implement, criticize, verify, and
summarize the same work. Those functions have different cost and independence
needs. Mixing them encourages shallow breadth, self-certification, and expensive
models doing mechanical work.

Fleet separates those functions into bounded seats. The lead remains responsible
for the mission and final synthesis. Each worker receives one leaf task, a
checkable output, an authority ceiling, and a stop condition. Parallelism is a
tool for independent work, not a goal or a proxy for correctness.

## The essence

```text
one mission
  -> deterministic checks first
  -> smallest useful set of independent seats
  -> lane matched to difficulty
  -> typed seat outputs
  -> independent verification
  -> one evidence-backed synthesis
```

Fleet answers three questions:

1. Which parts of the mission are genuinely independent?
2. What is the least expensive GPT lane that can satisfy each contract?
3. What evidence makes the final synthesis trustworthy?

## What it does

- Decomposes a broad mission into bounded leaf seats.
- Routes difficult synthesis to Sol, grounded everyday work to Terra, and
  repeatable breadth to Luna.
- Runs independent seats concurrently within explicit width limits.
- Preserves one answer, event stream, error log, and status record per batch
  seat.
- Treats unavailable models, timeouts, quota, and empty output as missing
  evidence.
- Requires the lead to verify load-bearing claims before using them.

## What it does not do

- It does not turn model agreement into truth.
- It does not create a permanent society of agents or let workers spawn workers.
- It does not unlock models or bypass ChatGPT-plan limits.
- It does not route to third-party providers when a GPT lane is unavailable.
- It does not grant workers permission to publish, deploy, purchase, message,
  sign, or mutate external systems.

## The three lanes

The lane names are stable roles. The exact model bindings live in
`../models.json` and remain account-dependent.

| Lane | Best fit | Poor fit |
| --- | --- | --- |
| Sol | ambiguous framing, architecture, adversarial synthesis, final review | repetitive extraction |
| Terra | implementation, grounded analysis, reduction, peer review | high-volume mechanical shards |
| Luna | classification, extraction, replication, bounded source mapping | sole final authority |

Use the fewest seats that cover independent evidence. A five-wide limit is a
safety ceiling, not a target.

## Two execution modes

### Interactive Fleet

Use Codex collaboration when the user is present and the mission benefits from
live steering. The lead creates bounded seats, waits for their outputs, verifies
claims, and reports a roster. This mode needs no bundled runner.

### Batch Fleet

Use `scripts/fleet.py` for trusted local scheduling or repeatable shell-driven
work. A JSONL manifest binds each seat to a lane and a prompt file. The runner:

- validates every model as GPT-only;
- rejects prompt paths that escape the selected work directory, including
  symlink escapes;
- invokes `codex exec` without a shell;
- defaults to a read-only sandbox;
- clamps global and per-lane concurrency;
- writes private run artifacts with restrictive permissions;
- exits nonzero when any seat fails.

Dry-run validates the roster without launching a model or writing a run.

## Expected output

An interactive mission ends with:

```text
seat | lane | model | status | role | used in synthesis
verified claims
rejected or unverified claims
next commands
```

A batch ends with `roster.json` plus one directory per seat containing
`answer.md`, `events.jsonl`, `stderr.log`, and `status.json`.

## Example missions

### Repository release review

```text
Use $fleet. Map the changed surfaces with Luna, review implementation risk with
Terra, and use one Sol seat only for final release judgment. Read-only. Every
finding needs file-and-line evidence and a falsifier.
```

### Source-grounded research

```text
Use $fleet to divide these primary sources into four independent evidence
shards. Deduplicate the claims, then have a fresh Terra seat challenge only the
load-bearing conclusions. Unsupported claims remain UNVERIFIED.
```

### When not to use Fleet

Do not launch Fleet for a question settled by one command, one file, one small
edit, or one deterministic test. Run the command or make the edit directly.

## Self-contained and privacy boundary

Fleet contains its model policy, runner, tests, and operating contract. It uses
the user's existing Codex sign-in and never reads the authentication cache. The
runner sends only the prompt files explicitly named in the manifest, and those
files must resolve inside the chosen work directory.

The skill contains no private project schema, internal service, provider key,
or hosted dependency. Public users bring their own mission, repository, and
Codex model access.

## Honest limitations

- Model availability and plan capacity are controlled by the signed-in account.
- Same-model seats are correlated even when their prompts differ.
- The runner records execution; it does not prove the truth of an answer.
- Process-level scheduling is intentionally small. Add a queue or daemon only
  after measured local workloads exceed flat JSONL manifests and OS scheduling.
