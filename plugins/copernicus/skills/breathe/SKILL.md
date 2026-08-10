---
name: breathe
description: Run a deep, bounded GPT-only Luna Fleet investigation and compress it into a decision-complete brief for a time-limited human. Use when the user says Breathe, brief me after deep work, investigate autonomously until a decision is needed, use deep Luna map-reduce, autoencoder-style investigation, compress a fleet, preserve the essence, or asks for machine-scale investigation with minimal human oversight. Do not use for an ordinary summary, a question settled by one check, or work without a concrete decision boundary.
---

# Breathe

Widen the investigation, narrow the interruption. Breathe composes Copernicus
Fleet; it does not add another provider, runner, daemon, or agent hierarchy.

Resolve `<breathe-skill-dir>` to the directory containing this `SKILL.md`.
Resolve the sibling Fleet skill at `<breathe-skill-dir>/../fleet/`. Read
[guide.md](references/guide.md) when explaining Breathe, changing this skill,
or designing a new briefing profile.

Open with:

```text
Using Breathe: deep GPT-only investigation, compressed at your decision boundary.
Mission: <one sentence>.
Budget: <maximum Luna waves/seats>; I will interrupt only for <named decisions or blockers>.
```

## Frame the bottleneck

Before launching workers, name:

- the outcome and current decision, not merely the topic;
- the user's authority boundary and actions that still require approval;
- at most three decisions the next brief may ask the user to make;
- the smallest evidence that would change each decision;
- a hard mission budget. Default to at most three Luna map waves of five seats,
  stopping earlier when coverage closes;
- a brief budget of 350 words above the trace unless the user asks otherwise.

Run deterministic inventory first. Use commands, tests, parsers, and primary
sources before model seats. Put temporary manifests, prompts, and outputs in an
ignored mission directory such as `.copernicus/runs/breathe-<mission>/`; never
put secrets in worker prompts.

## Inhale: map broadly

Use the sibling `$fleet` contract. Luna is the map lane and runs in waves of at
most five. Each leaf receives a distinct evidence slice, role, falsifier, and
typed output. A leaf must say `Do not spawn subagents`.

Map output:

```text
CLAIMS: id | claim | decision impact | evidence | confidence | falsifier
CONTRADICTIONS: claim ids | unresolved difference | evidence needed
GAPS: missing evidence | affected decision | cheapest next check
STOP: complete | UNVERIFIED reason
```

Duplicate prompts are allowed only for named blind replication. A failed or
timed-out seat is missing evidence, not a vote. Preserve it in the roster.

For a shell-driven mission, use Fleet's existing runner rather than writing a
new dispatcher:

```bash
python3 <breathe-skill-dir>/../fleet/scripts/fleet.py batch manifest.jsonl \
  --run-dir .copernicus/runs/breathe-<mission>/map-01 --workdir .
```

## Hold: reduce, test, and decide whether to breathe again

Use a bounded Terra reducer to cluster semantically equivalent claims, retain
material dissent, and assign stable claim handles. Reducers are explicit Fleet
seats and never certify their own synthesis.

Start another Luna wave only when every condition holds:

1. a named evidence gap can change a live decision;
2. the next seats have non-overlapping contracts;
3. deterministic checks cannot close the gap more cheaply;
4. the hard mission budget remains.

Stop mapping when any condition fails, the latest wave adds no verified
decision-relevant information, two seats in a wave hit pressure failures, or a
human decision is required. Verify load-bearing claims with commands or primary
sources, then use a fresh Terra or Sol seat only where semantic review remains
necessary. Correlated Luna agreement is never verification.

## Exhale: emit the decision brief

Put the human layer first. Do not make the user read the roster to find the
decision.

```text
BREATHE BRIEF

Bottom line
- no more than three bullets

Decisions now
1. decision — recommendation — consequence of yes/no/wait

What changed
- only information that changes priority, confidence, or action

Risks and unknowns
- material dissent, uncertainty, and missing evidence

After your decision
- what continues autonomously; what remains separately authorized

Expand
- handles such as C17 evidence, R2 dissent, or W3 roster
```

Keep the section above the trace within the brief budget. Every load-bearing
sentence must map to a verified claim handle. Put the compact Fleet roster and
evidence index after the brief, preferably in a collapsed `Trace` section. If
compression would hide a safety blocker or material dissent, exceed the word
budget and say why.

After the user decides, acknowledge the choice in one line and continue. Ask a
follow-up only when it changes the decision, authority, or safety boundary.

## Learn from explicit feedback

The bundled ledger records controlled workflow signals, never project content.
Inspect it before a mission:

```bash
python3 <breathe-skill-dir>/scripts/experience.py summary
```

Adapt only after at least three explicit signals. Record feedback only when the
user explicitly calls a briefing section useful, not useful, too detailed, too
thin, missing a decision, wrongly prioritized, or asks to expand it:

```bash
python3 <breathe-skill-dir>/scripts/experience.py record \
  --signal expanded --section risks
```

Allowed signals and sections are printed by `experience.py record --help`. Silence,
task continuation, and lack of correction are not feedback. The ledger stores
only version, UTC time, signal, and section in a private local file. It never
stores free text, project names, paths, claim contents, prompts, or decisions.
It may tune emphasis and density; it must never rewrite this skill or treat a
preference as evidence about a project. Never encode the user's yes/no project
decision as briefing feedback.

## Hard rules

- GPT-only; use the user's existing Codex sign-in and the sibling Fleet policy.
- The lead owns waves. Workers and reducers never spawn workers.
- No model output becomes truth without evidence or a runnable check.
- Preserve contradictions, blocked seats, and uncertainty through compression.
- Do not perform external writes, publishing, deployment, purchases, messages,
  signatures, destructive actions, or secret access without separate authority.
- Optimize for fewer human interruptions, not less human control.
