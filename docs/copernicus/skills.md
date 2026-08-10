---
type: guide
title: Copernicus skills
description: Why the five installable Copernicus skills exist, how they work together, what they produce, and what they deliberately do not do.
tags: [copernicus, skills, fleet, breathe, auto-research, rick-rubin, html-report]
timestamp: 2026-08-10T00:00:00+02:00
---

# Copernicus skills

Installing the single `copernicus` plugin installs five skills.
They form a small sequence, not an agent society:

```text
$rick-rubin      remove weak branches
      ↓
$fleet           execute independent bounded work
      ↓
$breathe         compress deep work at the human decision boundary
      ↓
$auto-research   evaluate, join evidence, and curate learning
      ↓
$html-report     explain the evaluated work to a human reader
```

Each skill can be invoked independently; Breathe deliberately composes the
sibling Fleet execution contract. Installing the plugin adds workflow
instructions, references, and four Python standard-library tools; it does not
install a daemon, database, provider proxy, or background service.

## The skills

| Skill | Why it exists | What it produces |
| --- | --- | --- |
| `$rick-rubin` | Idea generation is easier than principled selection. | Essence, what stays, what goes, and the hardest cut. |
| `$fleet` | Breadth, implementation, criticism, and verification need different bounded roles. | Seat roster, typed outputs, verified synthesis, and explicit evidence gaps. |
| `$breathe` | Machine-scale investigation can overwhelm the person responsible for the next decision. | A decision-complete brief, expandable claim handles, and a compact trace. |
| `$auto-research` | Hard problems need comparable experiments and a safe boundary between guesses and memory. | A problem-specific DAG, candidates, evaluation receipts, and proposed OKF knowledge. |
| `$html-report` | Evaluated work still needs a clear human-facing explanation or decision aid. | One portable HTML brief, update, explanation, decision, review, or lesson. |

The complete explanations ship inside the installed plugin:

- [Fleet explained](../../plugins/copernicus/skills/fleet/references/guide.md)
- [Breathe explained](../../plugins/copernicus/skills/breathe/references/guide.md)
- [Auto-Research explained](../../plugins/copernicus/skills/auto-research/references/guide.md)
- [Rick Rubin subtraction explained](../../plugins/copernicus/skills/rick-rubin/references/guide.md)
- [HTML reports explained](../../plugins/copernicus/skills/html-report/references/guide.md)

## Why these five

They address five different failure modes:

1. **Too many possibilities** — subtraction reduces the search space.
2. **One agent doing incompatible jobs** — Fleet separates bounded work and
   verification while keeping one accountable lead.
3. **Machine output becoming human coordination work** — Breathe reduces deep
   map waves to the next decision while preserving expandable evidence and dissent.
4. **Learning from unverified guesses** — Auto-Research freezes the regime,
   evaluates candidates, joins evidence, and updates memory only at a cycle
   boundary.
5. **Work that remains opaque after it is done** — HTML Report turns authorized,
   evaluated material into a standalone reader-first explanation without making a
   dashboard, hosted service, or new source of truth.

No skill is authoritative by itself. Commands, tests, measurements, primary
sources, and human decisions remain the evaluators.

## Install and find them

```bash
codex plugin marketplace add Babinci/copernicus
codex plugin add copernicus@copernicus
codex plugin list
```

Start a new Codex task after installation. In the app, open `/plugins`, select
**Copernicus**, and inspect its five skills. Invoke them explicitly as
`$rick-rubin`, `$fleet`, `$breathe`, `$auto-research`, and `$html-report`.

## A complete example

```text
Use $rick-rubin to reduce these options to the few that serve the named user.
Use $fleet only for independent evidence work, with a maximum of five read-only
seats. Use $breathe to reduce the verified findings to at most three decisions
with expandable evidence handles. Then use $auto-research for one measured cycle: name the regime,
evaluator, falsifier, evidence gaps, and proposed OKF cards. Do not promote
memory or perform external actions without my approval. Finally, use
$html-report to produce a standalone decision explanation from the joined
evidence; separate observed facts, inferences, and unknowns.
```

## Self-contained public boundary

The plugin contains everything specific to the method:

- skill instructions and human-readable guides;
- GPT-only lane policy;
- the Fleet batch runner and tests;
- Breathe's decision-compression contract, guide, and private enum-only feedback tool;
- the SAS graph/receipt contracts;
- the receipt validator and tests;
- the HTML report generator, static safety checker, and tests.

Public users supply only their own problem, authorized materials, real
evaluator, Codex sign-in, and model access. The plugin contains no private
project names, private paths, credentials, internal endpoints, wallets, trace
identifiers, or copied research artifacts.

The Fleet runner sends only explicitly named prompt files that resolve inside
the selected work directory. Breathe's optional experience ledger stores only
controlled feedback categories in private local state. Auto-Research writes only
to the run directory the user chooses. Rick Rubin is prompt-only.

## Deliberate limits

- Model availability remains account- and workspace-dependent.
- Local hash chains detect edits but not truncation to a valid prefix without
  an external anchor.
- Model consensus is not verification.
- External publishing, deployment, purchases, messages, signatures,
  credentials, and destructive actions remain separately authorized.
