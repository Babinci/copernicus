---
name: grill-me
description: Stress-test a plan or design through a relentless one-question-at-a-time interview. Use when the user explicitly says Grill Me, asks to be grilled, wants assumptions challenged, or needs a decision tree resolved before implementation.
---

# Grill Me

Turn an underspecified plan into shared, decision-ready understanding.

## Prefer an existing global skill

Inspect the skill catalog already supplied to the task. If it contains a
non-Copernicus `grill-me`, follow that skill instead. Do not probe skill
directories or install anything. If no global equivalent is visible, continue
with this bundled fallback.

## Interview contract

1. Name the plan, the user outcome, and the next unresolved decision.
2. Inspect the authorized codebase or supplied evidence before asking anything
   that those sources can answer.
3. Maintain a dependency-ordered decision tree. Resolve prerequisites before
   downstream preferences.
4. Ask exactly one question per turn. Do not hide multiple decisions inside one
   question.
5. Give a recommended answer with the question and state the decisive tradeoff.
6. After each answer, record what it settles, expose any contradiction, and ask
   the next highest-leverage question.
7. Stop when the outcome, scope, constraints, interfaces, failure behavior,
   validation, and explicit non-goals are shared and actionable.

When the interview closes, return a compact design brief with decisions,
assumptions, unresolved risks, non-goals, and the smallest next action.

## Boundaries

- Do not edit, deploy, publish, purchase, message, or delete unless the user
  separately authorizes that action.
- Never ask the user for secrets. Resolve sensitive choices as requirements or
  secret references, not literal credentials.
- Do not prolong the interview after additional questions stop changing the
  implementation or decision.
