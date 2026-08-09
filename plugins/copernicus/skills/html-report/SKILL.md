---
name: html-report
description: Create, validate, or improve a portable self-contained HTML report for a status update, decision, explanation, review, lesson, or concise daily brief. Use when the user asks for an HTML report, visual briefing, project update, decision memo, explainable report, learning lesson, reflection quiz, or a report that should open offline in a browser.
---

# Practitioner HTML Reports

Make a reader-first artifact, not a dashboard or a transcript. The report must
answer a real reader question, state what is observed versus inferred, and leave
the reader with a clear next action or understanding.

Resolve `<report-skill-dir>` to the directory containing this `SKILL.md` and
resolve the script and guide from there, never from the current directory.

Read [guide.md](references/guide.md) before choosing a report mode, generating
an artifact, or changing this skill. It defines the input contract, visual
rules, modes, safety boundaries, diagram handoff, and limits.

## Choose one shape

| Mode | Reader question |
| --- | --- |
| `brief` | What matters now? |
| `update` | What changed since the last checkpoint? |
| `explanation` | How or why does this work? |
| `decision` | Which option should I choose? |
| `review` | Is this artifact or change acceptable? |
| `lesson` | Can I understand and apply this? |

Do not use a report when a short answer is clearer. Do not use a dashboard when
the reader needs one causal argument.

## Generate

Write a small JSON input with a title, mode, summary, at least one section, and
the facts/inferences/unknowns that matter. Then generate and check it:

```bash
python3 <report-skill-dir>/scripts/report.py generate report.json report.html
python3 <report-skill-dir>/scripts/report.py check report.html
```

The generator emits one offline HTML file with inline CSS and optional inline
SVG. It escapes every input value, rejects common secret/private-path patterns
by default, rejects unsafe sidecar paths, and refuses to overwrite an existing
file unless `--overwrite` is explicit. Use `--allow-private` only for a
deliberately authorized local-only report; it never makes publication safe.

## Core report contract

- Use one reader question and one report mode.
- Put the conclusion or model before process history.
- For a decision, review, update, or any recommendation, supply the relevant
  **Observed**, **Inferred**, or **Unknown** content. The generator rejects an
  evidence-bearing report with no such boundary.
- Cite consequential evidence in plain language; include a falsifier with a
  recommendation.
- Use one small flow diagram only when spatial relationships clarify the idea.
  It needs a textual fallback in the report.
- Keep the core useful without JavaScript. A `lesson` may use an optional native
  `<details>` reveal as a reflection check, but its answer is author-provided,
  not an independent evaluator or proof of learning.
- Use a relative `.excalidraw` sidecar only when a human-editable diagram adds
  value. The report must remain complete when the sidecar is absent.
- Run the checker after every generated or hand-edited report.

## Integrate with Copernicus

- Use `$rick-rubin` before a report to remove sections that do not change the
  reader's understanding or decision.
- Render Fleet and SAS results only after deterministic checks and evidence
  joins. A report is a derived artifact, never verification or durable OKF
  memory.
- Link to OKF cards or source artifacts with relative links when appropriate;
  do not promote a report's prose into memory without the normal cycle-boundary
  evidence process.

The workflow is self-contained: Markdown/JSON input, Python standard library,
and browser-native HTML. It has no service, database, provider, tracker,
external asset, or background process.
