---
type: guide
title: Practitioner HTML reports
description: A self-contained report workflow for clear status, decisions, explanations, reviews, and lessons without a hosted dashboard.
tags: [copernicus, html, reports, diagrams, learning, accessibility]
timestamp: 2026-08-09T00:00:00+02:00
---

# Practitioner HTML reports

`$html-report` turns authorized, already-evaluated material into a reader-first
HTML file. It exists for the moment when a terminal transcript, graph, or pile
of evidence is technically available but not yet understandable enough to make
or revisit a decision.

The artifact is local, portable, and useful offline. It does not replace a
trusted evaluator, a Fleet synthesis, SAS receipts, or OKF memory.

## What it produces

One standalone `.html` report with inline CSS, optional inline SVG, semantic
structure, and no required network, font, service, tracker, or JavaScript. It
supports six reader questions:

| Need | Mode |
| --- | --- |
| A concise daily/status answer | `brief` |
| A checkpoint with a baseline and delta | `update` |
| A clear mental model of a mechanism | `explanation` |
| A trade-off and recommendation | `decision` |
| A readiness, quality, or safety assessment | `review` |
| A worked explanation with a reflection check | `lesson` |

Decision, review, update, and recommendation reports identify the relevant
observed facts, inferences, or unknowns. A recommendation also carries a
falsifier so the reader knows what could overturn it.

## Why it stays small

The report is an artifact, not a new product surface. Copernicus intentionally
does not bundle a viewer, dashboard, database, hosted quiz, tracker, provider,
or background worker. A browser can open the file directly; an existing local
viewer may index it, but is not required.

The optional lesson interaction uses native HTML disclosure: read, predict, and
reveal an author-provided answer. It is useful for self-checking but is not an
independent correctness evaluator, proof of learning, or durable learner state.

## Human-editable diagram flow

Use a small inline flow diagram when spatial relationships clarify the report.
For a branchy plan or live human discussion, keep an optional editable sidecar
next to the report. The report remains complete without it.

- [Open the editable workflow diagram](practitioner-report-flow.excalidraw)
- [Read the skill's report and sidecar contract](../../plugins/copernicus/skills/html-report/references/guide.md)

```text
authorized evidence -> report.html -> human understanding / decision
                         ↕ explicit refresh after discussion
                  workflow.excalidraw (optional)
```

No diagram edit writes back into report claims. Refresh the report deliberately
after a human changes the diagram or the evidence.

## Place in the Copernicus workflow

```text
$rick-rubin -> remove non-essential branches
      ↓
direct evidence or $fleet -> deterministic checks / joined evidence
      ↓
$auto-research -> optional evaluated cycle and curated OKF cards
      ↓
$html-report -> derived explanation for a human reader
```

The final arrow is one-way: report prose is not promoted into OKF memory without
the normal evidence and cycle-boundary process.

## Safety and limits

The included standard-library generator escapes interpolated content and rejects
common secret/private-path patterns, unsafe links, runtime code, remote assets,
and broken local anchors. It provides a practical baseline, not a promise of
complete secret detection, factual correctness, WCAG conformance, or legal
review. Review every output before sharing it.

Use `--allow-private` only for an explicitly authorized local artifact. It does
not make a report safe to publish and does not disable escaping.

## Try it

```bash
python3 plugins/copernicus/skills/html-report/scripts/report.py generate report.json report.html
python3 plugins/copernicus/skills/html-report/scripts/report.py check report.html
```

See [the complete skill guide](../../plugins/copernicus/skills/html-report/references/guide.md)
for the JSON contract, mode selection, reflection checks, and diagram handoff.
