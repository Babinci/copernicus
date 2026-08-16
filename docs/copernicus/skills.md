---
type: guide
title: Copernicus skills
description: Why the twelve installable Copernicus skills exist, how they work together, what they produce, and what they deliberately do not do.
tags: [copernicus, skills, grill-me, rick-rubin, planning, fleet, breathe, auto-research, okf-docs, html-report, retrospective, ponytail, caveman, handoff]
generated: { by: "copernicus/0.9.0", at: 2026-08-15T00:00:00+02:00 }
---

# Copernicus skills

Installing the single `copernicus` plugin installs twelve skills. Eight form
the main problem-solving sequence; four govern review, implementation,
delivery, and continuation:

```text
$grill-me        resolve the decision tree
      ↓
$rick-rubin      remove weak branches
      ↓
$planning        turn substantial work into linked, test-first workpacks
      ↓
$fleet           execute independent bounded work
      ↓
$breathe         compress deep work at the next human checkpoint
      ↓
$auto-research   evaluate, join evidence, and curate learning
      ↓
$okf-docs        traverse and maintain large OKF knowledge bundles
      ↓
$html-report     explain the evaluated work to a human reader

$retrospective   review outcomes and propose the next verified improvement
$ponytail        optionally constrain implementation to the smallest correct change
$caveman         optionally compress any conversational answer
$handoff         transfer current state to a fresh session
```

Each skill can be invoked independently; Breathe deliberately composes the
sibling Fleet execution contract. Installing the plugin adds workflow
instructions, references, and dependency-free Python tools; it does not
install a daemon, database, provider proxy, or background service.

## The skills

| Skill | Why it exists | What it produces |
| --- | --- | --- |
| `$grill-me` | Premature implementation hides unresolved product and architecture decisions. | One recommended question at a time, then a compact decision-ready design brief. |
| `$rick-rubin` | Idea generation is easier than principled selection. | Essence, what stays, what goes, and the hardest cut. |
| `$planning` | Substantial or resumable work needs an implementation contract that survives context loss. | One evidence-backed design, linked workpacks, tests or explicit waivers, and deterministic dependency indexes. |
| `$fleet` | Breadth, implementation, criticism, and verification need different bounded roles. | Typed outputs, private seat provenance, verified synthesis, and explicit evidence gaps. |
| `$breathe` | Machine-scale investigation can overwhelm the person responsible for the next checkpoint. | A checkpoint-complete brief for a decision, verified delivery, or understanding, with evidence and dissent expandable on request. |
| `$auto-research` | Hard problems need comparable experiments and a safe boundary between guesses and memory. | A problem-specific DAG, candidates, evaluation receipts, and proposed OKF knowledge. |
| `$okf-docs` | Large Markdown knowledge bundles need metadata, provenance, backlink, and dependency traversal beyond text search. | A deterministic OKF v0.2 graph, validation/health findings, budgeted evidence manifests, progressive indexes, or a reviewed v0.1 migration. |
| `$html-report` | Evaluated work still needs a clear human-facing explanation or decision aid. | One portable HTML brief, update, explanation, decision, review, or lesson. |
| `$retrospective` | Work history is easy to turn into hindsight stories instead of useful learning. | An evidence timeline, first divergence, keep/change/try, and ranked proposal-only actions. |
| `$ponytail` | Correct implementations often grow speculative machinery before the real path is traced. | The smallest complete change, one proportional check, and explicit skipped extensions. |
| `$caveman` | Long conversational prose can obscure the result. | An opt-in terse answer that preserves exact commands, uncertainty, warnings, and evidence. |
| `$handoff` | A fresh session needs decision state, not a duplicated transcript. | One redacted temporary Markdown brief linking durable artifacts and validation. |

The complete explanations ship inside the installed plugin:

- [Fleet explained](../../plugins/copernicus/skills/fleet/references/guide.md)
- [Breathe explained](../../plugins/copernicus/skills/breathe/references/guide.md)
- [Auto-Research explained](../../plugins/copernicus/skills/auto-research/references/guide.md)
- [Rick Rubin subtraction explained](../../plugins/copernicus/skills/rick-rubin/references/guide.md)
- [Planning explained](../../plugins/copernicus/skills/planning/references/guide.md)
- [OKF Docs explained](../../plugins/copernicus/skills/okf-docs/references/guide.md)
- [HTML reports explained](../../plugins/copernicus/skills/html-report/references/guide.md)
- [Grill Me contract](../../plugins/copernicus/skills/grill-me/SKILL.md)
- [Retrospective contract](../../plugins/copernicus/skills/retrospective/SKILL.md)
- [Ponytail contract](../../plugins/copernicus/skills/ponytail/SKILL.md)
- [Caveman contract](../../plugins/copernicus/skills/caveman/SKILL.md)
- [Handoff contract](../../plugins/copernicus/skills/handoff/SKILL.md)

## Why these twelve

They address twelve different failure modes:

1. **An unresolved plan** — Grill Me resolves one dependency-ordered decision at a time.
2. **Too many possibilities** — subtraction reduces the search space.
3. **A substantial plan that disappears with the session** — Planning keeps one
   evidence-backed design and a validated workpack DAG while leaving focused
   changes in native Plan Mode.
4. **One agent doing incompatible jobs** — Fleet separates bounded work and
   verification while keeping one accountable lead.
5. **Machine output becoming human coordination work** — Breathe reduces deep
   map waves to the next human checkpoint while preserving expandable evidence and dissent.
6. **Learning from unverified guesses** — Auto-Research freezes the regime,
   evaluates candidates, joins evidence, and updates memory only at a cycle
   boundary.
7. **Knowledge too wide for text search** — OKF Docs queries complete YAML,
   traverses typed structural edges, and selects a reproducible evidence packet
   without replacing Markdown with a database.
8. **Work that remains opaque after it is done** — HTML Report turns authorized,
   evaluated material into a standalone reader-first explanation without making a
   dashboard, hosted service, or new source of truth.
9. **History becoming hindsight fiction** — Retrospective separates observed
   evidence from inference, finds the first divergence, and proposes a check.
10. **Implementation buried in machinery** — Ponytail traces the real flow, then
   stops at the earliest native or existing solution that fully holds.
11. **Answers buried in prose** — Caveman compresses wording while retaining all
   load-bearing technical and safety detail.
12. **Context loss between sessions** — Handoff moves only current decision state
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
**Copernicus**, and inspect its twelve skills. Invoke them explicitly as
`$grill-me`, `$rick-rubin`, `$planning`, `$fleet`, `$breathe`, `$auto-research`,
`$okf-docs`, `$html-report`, `$retrospective`, `$ponytail`, `$caveman`, and `$handoff`.

## Global companion resolution

Grill Me, Ponytail, Caveman, and Handoff are bundled fallbacks, so a Copernicus
install is self-contained. The host namespaces plugin skills. At activation,
each fallback checks only the skill catalog already supplied by the host and
defers to a visible non-Copernicus equivalent. It never scans or writes global
skill directories and never runs an installer hook.

This preference is best-effort because the host may disable or omit a global
skill from a shortened catalog. In that case the bundled fallback runs. Use the
skill picker or an explicit host-qualified entry when both variants are visible
and you need to force one. Copernicus does not claim to control host precedence.

## A complete example

```text
Use $grill-me to resolve the highest-leverage unknowns one question at a time.
Then use $rick-rubin to reduce the options to the few that serve the named user.
Use $planning when the remaining work is substantial or resumable: write one
evidence-backed design, materialize tests when authorized, and validate the
linked workpacks before implementation. Keep focused work in native Plan Mode.
Use $fleet only for independent evidence work, with a maximum of five read-only
seats and the default terra-first preset. Use $breathe to reduce the verified
findings to the next decision, verified delivery, or understanding checkpoint
with expandable evidence handles. Then use $auto-research for one measured cycle: name the regime,
evaluator, falsifier, evidence gaps, and proposed OKF cards. Do not promote
memory or perform external actions without my approval. Use $okf-docs to
validate and traverse a large authorized OKF bundle, selecting a bounded,
hashed evidence manifest before reading widely. Finally, use
$html-report to produce a standalone decision explanation from the joined
evidence; separate observed facts, inferences, and unknowns.
Use $retrospective after validation to identify the first evidence-backed
divergence and propose the next check.
Use $ponytail for the smallest correct implementation and one proportional
check. Use $caveman only for the conversational summary. Use $handoff if the
work must continue in a fresh session; link durable artifacts instead of
copying them.
```

## Self-contained public boundary

The plugin contains everything specific to the method:

- skill instructions and human-readable guides;
- GPT-only lane policy;
- the Fleet batch runner and tests;
- the Planning workpack validator/indexer and tests;
- the OKF v0.2 traversal, validation, progressive-index, migration tool and tests;
- Breathe's checkpoint-compression contract, guide, and private enum-only feedback tool;
- the SAS graph/receipt contracts;
- the receipt validator and tests;
- the HTML report generator, static safety checker, and tests;
- the evidence-first Retrospective review contract;
- four prompt-only companion fallbacks and their bundled MIT notices.

Public users supply only their own problem, authorized materials, real
evaluator, Codex sign-in, and model access. The plugin contains no private
project names, private paths, credentials, internal endpoints, wallets, trace
identifiers, or copied research artifacts.

The Fleet runner sends only explicitly named prompt files that resolve inside
the selected work directory. Breathe's optional experience ledger stores only
controlled feedback categories in private local state. Auto-Research writes only
to the run directory the user chooses. Rick Rubin is prompt-only.
OKF Docs reads only the selected bundle root; writes are explicit, dry-run
first, and bounded to owned index regions or the narrow v0.1 migration.
Planning writes only to the bundle path the user chooses and never executes
workpack commands.
Retrospective is prompt-only and proposal-only unless the user separately
authorizes an implementation.

## Deliberate limits

- Model availability remains account- and workspace-dependent.
- Local hash chains detect edits but not truncation to a valid prefix without
  an external anchor.
- Model consensus is not verification.
- External publishing, deployment, purchases, messages, signatures,
  credentials, and destructive actions remain separately authorized.
