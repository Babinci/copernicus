# Practitioner HTML report guide

## Purpose

Use a report when a reader needs to understand a non-trivial situation without
reconstructing the whole working session. The artifact is a portable explanation
or decision aid, not a source of truth and not a dashboard application.

## Mode selection

| Mode | Use for | Required content | Avoid when |
| --- | --- | --- | --- |
| `brief` | Daily or concise status | current state, key fact, blocker, next action | causal history matters |
| `update` | A measured checkpoint | baseline, delta, impact, unresolved items | no prior state exists |
| `explanation` | A mechanism or code/system model | question, model, example, assumptions, takeaway | a choice must be made |
| `decision` | A bounded choice | alternatives, criteria, trade-off, recommendation, falsifier | reviewing a fixed artifact |
| `review` | Quality, safety, or readiness | scope, checks, findings, risks, verdict | selecting among new options |
| `lesson` | Teaching a novel idea | objective, concept, example, reflection, recap | status or approval is the goal |

Every mode shares a title, a short summary, and at least one substantive
section. A decision, review, update, or recommendation must also provide at
least one explicit truth boundary; use the fewest sections that make the
argument legible.

## JSON input

The generator intentionally accepts a small JSON schema. Unknown keys are
ignored so a practitioner can keep task-specific notes next to the structured
fields.

```json
{
  "title": "Choosing a safer release path",
  "mode": "decision",
  "summary": "Use the staged path because it preserves rollback evidence.",
  "audience": "Maintainers",
  "scope": "One release candidate",
  "sections": [
    {
      "heading": "Decision model",
      "body": "Compare the two paths against rollback and evidence quality.",
      "items": ["Stage and validate", "Promote only after the gate passes"]
    }
  ],
  "facts": ["The candidate has a reproducible build."],
  "inferences": ["A staged path reduces recovery uncertainty."],
  "unknowns": ["Production traffic behavior is not yet measured."],
  "recommendation": {
    "text": "Use the staged path for this candidate.",
    "falsifier": "A staging run that cannot preserve a working rollback proves this recommendation wrong."
  },
  "sources": ["Local validation output, observed 2026-08-09"],
  "diagram": {
    "title": "Release flow",
    "description": "Evidence flows from build to gate to promotion.",
    "steps": ["Build", "Validate", "Promote"],
    "sidecar": "release-flow.excalidraw"
  }
}
```

### Fields

- `title`, `mode`, `summary`, and `sections` are required.
- A section has `heading` plus `body`, `items`, or both. Treat bodies as plain
  text; the generator escapes them rather than interpreting Markdown or HTML.
- `facts`, `inferences`, and `unknowns` are optional lists of plain strings.
  A decision, review, update, or recommendation needs at least one non-empty
  list so the reader can tell what is grounded and what remains open.
- `recommendation` has `text` and `falsifier`. Omit it when no action is being
  recommended.
- `sources` may contain plain strings or `{ "label": "...", "url": "https://..." }`.
  Links are citations a reader chooses to open, never runtime dependencies.
- `diagram.steps` is a simple 2–6 step flow. Use an editable sidecar for a
  non-linear graph, branch-heavy plan, or collaborative arrangement.
- `quiz` is optional only in `lesson` mode and has `question`, 2–6 `choices`,
  `answer`, and optional `explanation`. It renders as a native disclosure, not
  model grading.

## Visual and accessibility baseline

- Prefer semantic headings, lists, tables, and native disclosure controls.
- Use text and structure—not color alone—to convey a difference or status.
- Keep diagrams small, include a title and description, and explain the same
  relationship in nearby prose.
- Keep the report readable with JavaScript disabled and on narrow screens.
- Use inline CSS and SVG only. Do not use web fonts, remote images, embeds,
  tracking, forms, iframes, scripts, or a report-viewer dependency.

## Safety and truth boundaries

The generator checks document structure and common leak/injection patterns; it
does not certify factual correctness, accessibility conformance, or complete
secret detection. Review output before sharing it.

1. Supply only authorized evidence.
2. Redact names, private paths, credentials, source excerpts, wallets, and
   environment data that do not belong in the artifact.
3. Keep observed facts, inferences, and unknowns distinct.
4. Mark model-written content provisional when it has not been independently
   evaluated.
5. Give a consequential recommendation a falsifier.
6. Run `check` after generation and again after hand edits.

The `--allow-private` escape hatch bypasses only the conservative content scan
for an explicitly authorized local artifact. It does not authorize sharing,
remove legal/ethical obligations, or disable HTML escaping.

## Excalidraw handoff

Keep a report and editable diagram as two local files when rearranging the graph
with a human is useful:

```text
handoff/
  report.html
  workflow.excalidraw   # optional
```

The report links to the sidecar with a relative path and carries enough prose to
stand alone. A human edit to the diagram does not update report claims; refresh
the report deliberately after the discussion. Do not embed an editor or require
a network preview.

## Fleet, SAS, and OKF

Use a report after a bounded Fleet synthesis or a joined SAS cycle to make the
evidence legible to a human. Do not treat it as an evaluator, a receipt, a
candidate, or an OKF card. Link to evidence and curate OKF memory through the
normal cycle-boundary process.

## Commands

```bash
python3 <report-skill-dir>/scripts/report.py generate report.json report.html
python3 <report-skill-dir>/scripts/report.py check report.html
python3 <report-skill-dir>/scripts/report.py generate --overwrite report.json report.html
python3 <report-skill-dir>/scripts/report.py generate --allow-private report.json local-only.html
```

Use `--allow-private` only after an explicit local authorization decision.
