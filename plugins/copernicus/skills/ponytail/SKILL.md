---
name: ponytail
description: Find the smallest correct implementation after tracing the real code path. Use only when the user explicitly invokes Ponytail, asks for a lazy senior-developer pass, requests YAGNI or minimum-code implementation, or says to stop over-engineering.
---

# Ponytail

Choose the first solution that fully holds, with the least code and machinery.
Efficiency never excuses shallow understanding, missing safety, or an incomplete
requirement.

## Prefer an existing global skill

Before using this fallback, inspect the skill catalog already visible in the
current context. If a non-Copernicus Ponytail skill is visible, read and follow
that skill instead. Do not probe skill
directories or install anything. If no global equivalent is visible, use this
bundled contract so Copernicus remains self-contained.

## Activation

Activate only after an explicit invocation. Keep it active for the current task
until the user says `stop ponytail` or `normal mode`. Default to **full**. Treat
`lite`, `full`, and `ultra` as increasing pressure to remove optional machinery;
never relax correctness or the safety boundary.

## Method

Read the request and trace the affected flow end to end before choosing a
solution. Search the repository for existing helpers, patterns, and every caller
of the function about to change. Then stop at the first rung that works:

1. **Does this need to exist at all?** Skip speculative needs and say why.
2. **Does the codebase already have it?** Reuse the existing path.
3. **Does the standard library do it?** Use it.
4. **Does the native platform do it?** Prefer native controls, CSS, or database
   constraints over custom machinery.
5. **Does an installed dependency do it?** Reuse it; do not add a dependency for
   a few lines.
6. **Can it be one line?** Use the one line when it remains clear and correct.
7. **Only then:** write the minimum custom code that works.

When two rungs work, take the earlier one. Prefer deletion over addition, boring
over clever, and the fewest touched files after the real flow is understood.

**Bug fix = root cause, not symptom.** Fix the smallest shared path that covers
all affected callers instead of adding guards to individual symptoms.

## Hard boundaries

- Never add speculative abstractions, one-implementation interfaces, factories,
  configuration, or scaffolding for later.
- Never simplify away trust-boundary validation, data-loss prevention, security,
  accessibility basics, calibration for physical systems, or anything the user
  explicitly requested.
- Non-trivial logic—a branch, loop, parser, money path, or security path—leaves
  one runnable check that fails when the behavior breaks. Do not build a test
  framework for a trivial change.
- Mark a deliberate shortcut with a known ceiling using a `ponytail:` comment
  that names the ceiling and the condition for replacing it.
- A complex request still gets the smallest complete version. State any skipped
  extension and the evidence that would justify adding it.

## Output

Put the implementation first. Follow with at most three short lines covering
what was skipped and when it should be added. If the user explicitly requests a
report or walkthrough, provide the requested depth. Ponytail controls what is
built; pair with Caveman only when terse conversational delivery is also wanted.
