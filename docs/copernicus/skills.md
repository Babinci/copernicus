---
type: guide
title: Copernicus skills
description: Why the eight installable Copernicus skills exist, how they work together, what they produce, and what they deliberately do not do.
tags: [copernicus, skills, grill-me, rick-rubin, fleet, breathe, auto-research, html-report, caveman, handoff]
timestamp: 2026-08-10T00:00:00+02:00
---

# Copernicus skills

Installing the single `copernicus` plugin installs eight skills. Six form the
main problem-solving sequence; two control delivery and continuation:

```text
$grill-me        resolve the decision tree
      ↓
$rick-rubin      remove weak branches
      ↓
$fleet           execute independent bounded work
      ↓
$breathe         compress deep work at the human decision boundary
      ↓
$auto-research   evaluate, join evidence, and curate learning
      ↓
$html-report     explain the evaluated work to a human reader

$caveman         optionally compress any conversational answer
$handoff         transfer current state to a fresh session
```

Each skill can be invoked independently; Breathe deliberately composes the
sibling Fleet execution contract. Installing the plugin adds workflow
instructions, references, and four Python standard-library tools; it does not
install a daemon, database, provider proxy, or background service.

## The skills

| Skill | Why it exists | What it produces |
| --- | --- | --- |
| `$grill-me` | Premature implementation hides unresolved product and architecture decisions. | One recommended question at a time, then a compact decision-ready design brief. |
| `$rick-rubin` | Idea generation is easier than principled selection. | Essence, what stays, what goes, and the hardest cut. |
| `$fleet` | Breadth, implementation, criticism, and verification need different bounded roles. | Seat roster, typed outputs, verified synthesis, and explicit evidence gaps. |
| `$breathe` | Machine-scale investigation can overwhelm the person responsible for the next decision. | A decision-complete brief, expandable claim handles, and a compact trace. |
| `$auto-research` | Hard problems need comparable experiments and a safe boundary between guesses and memory. | A problem-specific DAG, candidates, evaluation receipts, and proposed OKF knowledge. |
| `$html-report` | Evaluated work still needs a clear human-facing explanation or decision aid. | One portable HTML brief, update, explanation, decision, review, or lesson. |
| `$caveman` | Long conversational prose can obscure the result. | An opt-in terse answer that preserves exact commands, uncertainty, warnings, and evidence. |
| `$handoff` | A fresh session needs decision state, not a duplicated transcript. | One redacted temporary Markdown brief linking durable artifacts and validation. |

The complete explanations ship inside the installed plugin:

- [Fleet explained](../../plugins/copernicus/skills/fleet/references/guide.md)
- [Breathe explained](../../plugins/copernicus/skills/breathe/references/guide.md)
- [Auto-Research explained](../../plugins/copernicus/skills/auto-research/references/guide.md)
- [Rick Rubin subtraction explained](../../plugins/copernicus/skills/rick-rubin/references/guide.md)
- [HTML reports explained](../../plugins/copernicus/skills/html-report/references/guide.md)
- [Grill Me contract](../../plugins/copernicus/skills/grill-me/SKILL.md)
- [Caveman contract](../../plugins/copernicus/skills/caveman/SKILL.md)
- [Handoff contract](../../plugins/copernicus/skills/handoff/SKILL.md)

## Why these eight

They address eight different failure modes:

1. **An unresolved plan** — Grill Me resolves one dependency-ordered decision at a time.
2. **Too many possibilities** — subtraction reduces the search space.
3. **One agent doing incompatible jobs** — Fleet separates bounded work and
   verification while keeping one accountable lead.
4. **Machine output becoming human coordination work** — Breathe reduces deep
   map waves to the next decision while preserving expandable evidence and dissent.
5. **Learning from unverified guesses** — Auto-Research freezes the regime,
   evaluates candidates, joins evidence, and updates memory only at a cycle
   boundary.
6. **Work that remains opaque after it is done** — HTML Report turns authorized,
   evaluated material into a standalone reader-first explanation without making a
   dashboard, hosted service, or new source of truth.
7. **Answers buried in prose** — Caveman compresses wording while retaining all
   load-bearing technical and safety detail.
8. **Context loss between sessions** — Handoff moves only current decision state
   and references the durable sources already in the workspace.

No skill is authoritative by itself. Commands, tests, measurements, primary
sources, and human decisions remain the evaluators.

## Install and find them

```bash
codex plugin marketplace add Babinci/copernicus
codex plugin add copernicus@copernicus
codex plugin list
```

Start a new Codex task after installation. In the app, open `/plugins`, select
**Copernicus**, and inspect its eight skills. Invoke them explicitly as
`$grill-me`, `$rick-rubin`, `$fleet`, `$breathe`, `$auto-research`,
`$html-report`, `$caveman`, and `$handoff`.

## Global companion resolution

Grill Me, Caveman, and Handoff are bundled fallbacks, so a Copernicus install is
self-contained. The host namespaces plugin skills. At activation, each fallback
checks only the skill catalog already supplied by the host and defers to a
visible non-Copernicus equivalent. It never scans or writes global skill
directories and never runs an installer hook.

This preference is best-effort because the host may disable or omit a global
skill from a shortened catalog. In that case the bundled fallback runs. Use the
skill picker or an explicit host-qualified entry when both variants are visible
and you need to force one. Copernicus does not claim to control host precedence.

## A complete example

```text
Use $grill-me to resolve the highest-leverage unknowns one question at a time.
Then use $rick-rubin to reduce the options to the few that serve the named user.
Use $fleet only for independent evidence work, with a maximum of five read-only
seats. Use $breathe to reduce the verified findings to at most three decisions
with expandable evidence handles. Then use $auto-research for one measured cycle: name the regime,
evaluator, falsifier, evidence gaps, and proposed OKF cards. Do not promote
memory or perform external actions without my approval. Finally, use
$html-report to produce a standalone decision explanation from the joined
evidence; separate observed facts, inferences, and unknowns.
Use $caveman only for the conversational summary. Use $handoff if the work must
continue in a fresh session; link durable artifacts instead of copying them.
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
- three prompt-only companion fallbacks and their bundled MIT notices.

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
