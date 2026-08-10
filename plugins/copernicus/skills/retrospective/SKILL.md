---
name: retrospective
description: Reconstruct completed or ongoing work from observable evidence, identify the first meaningful divergence, preserve what worked, and propose the smallest verified improvements. Use for skill-usage reviews, repository or session retrospectives, postmortems, lessons learned, tracing a thinking blunder without inventing private reasoning, reviewing documentation while working, or scheduling read-only repository reviews that only propose actions.
---

# Retrospective

Turn history into a better next attempt. Use observable artifacts, not hindsight
storytelling. Default to review and proposals; change files or external systems
only when the user separately authorizes that action.

## Frame the review

Name the object, time window, intended outcome, actual outcome, authorized
evidence sources, and decision the retrospective should improve. If the request
already makes these clear, proceed without an interview.

**Evidence before interpretation.** Inventory the smallest useful set of source
artifacts first: relevant conversation or task history, commits, diffs, tests,
CI, issues, plans, docs, reports, and scheduled-task history. Cite paths, lines,
commits, commands, or URLs when available. Classify every material statement as
observed, inferred, or unknown.

Build a compact timeline:

```text
time/order | observed event or decision | evidence | consequence | confidence
```

Locate the **first observable divergence** between the intended result and what
actually happened. Trace forward to the outcome and backward to the earliest
cheap guard that could have caught it. Separate root cause, contributing
conditions, and trigger. Never invent hidden reasoning, private chain-of-thought,
or motives that were not recorded; mark missing decision evidence `UNVERIFIED`.

## Select a lens

### Skill-use evolution

Inspect all discoverable uses inside the authorized scope, not only the current
`SKILL.md`. Group recurring triggers, successful outcomes, missed triggers,
friction, unsafe behavior, and user corrections. Distinguish a skill defect from
model limits, missing evidence, tool failure, or a bad task frame.

For each supported improvement, propose:

```text
pattern | evidence | smallest instruction change | forward test | success signal | rollback
```

Do not let a skill rewrite itself from one anecdote. Prefer repeated evidence or
one severe, reproducible failure. Edit the skill only when the user asks for the
improvement, then run its existing validation and the smallest realistic test.

### Repository or session review

Compare the stated plan with the actual diff, verification, documentation, and
remaining risk. Identify useful practices to keep, unnecessary work to stop,
and one small experiment to try. When asked to maintain retrospective docs,
follow the repository's existing documentation and history conventions; do not
create a second diary, tracker, or source of truth.

### Blunder trace

Start from the confirmed bad outcome and walk the evidence backward. Name the
earliest mistaken or unsupported assumption only when an artifact records it.
Otherwise name the missing check or decision evidence, not a fictional thought.
Keep the review blameless and causal: the useful result is a guard, test, prompt,
or decision rule that makes recurrence cheaper to detect.

### Scheduled repository review

When the user explicitly asks for recurring review, use native scheduling or
automation through the host when available; do not invent a raw crontab or
daemon. Bind each task to named repositories, a cadence, a freshness window,
and read-only evidence. Keep scheduled execution **proposal-only**:

- inspect new commits, diffs, failing checks, stale documentation, and open risks;
- compare with the previous report when available and suppress unchanged advice;
- rank at most five actions by evidence, impact, effort, and urgency;
- never edit code, open issues or pull requests, publish, message, deploy, merge,
  or run destructive commands from the scheduled review.

Ask for authority only when the user wants a proposed action implemented.

## Emit the retrospective

```text
RETROSPECTIVE

Coverage
- object, time window, unavailable evidence, and previous report compared yes/no

Bottom line
- one evidence-backed sentence

What happened
- compact timeline; observed facts before inference

First divergence
- root cause, contributors, trigger, confidence, and missing evidence

Keep / change / try
- preserve one strength; stop or fix one weakness; run one bounded experiment

Proposed actions
1. action — evidence — smallest check — authority needed

Unknowns
- only gaps that could change the recommendation
```

Keep the output conversational unless the user requests a durable document.
Retrospective output is not an evaluator, canonical memory, or proof by itself.
Verify implemented actions through the repository's real checks.
