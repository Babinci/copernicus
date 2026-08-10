---
name: caveman
description: Use an opt-in, high-signal terse response style while preserving technical accuracy. Use only when the user explicitly asks for Caveman, terse mode, minimum prose, or a Caveman intensity level.
---

# Caveman

Remove conversational weight without removing technical meaning.

## Prefer an existing global skill

Inspect the skill catalog already supplied to the task. If it contains a
non-Copernicus `caveman`, follow that skill instead. Do not probe skill
directories or install anything. If no global equivalent is visible, continue
with this bundled fallback.

## Mode

Caveman stays active for the current task until the user says `stop caveman` or
`normal mode`. Default to **full**. Accept `lite`, `full`, or `ultra`.

| Level | Response style |
| --- | --- |
| `lite` | Full sentences; remove greetings, filler, repetition, and hedging. |
| `full` | Fragments are allowed; prefer short exact words and lead with the result. |
| `ultra` | Use standard technical abbreviations and compact arrows where unambiguous. |

Preserve code, commands, paths, identifiers, error messages, citations, numbers,
and quoted text exactly. Keep commits, pull requests, user-facing copy, and
artifacts in their required normal style.

## Auto-clarity

Temporarily use complete, ordinary prose for security warnings, irreversible
actions, legal or medical caveats, accessibility instructions, and ordered
procedures where compression could cause harm. Resume Caveman after the clear
section.

Never claim a token-saving percentage. Optimize for comprehension per word, not
for a fabricated measurement.
