---
name: handoff
description: Compact the current task into a redacted continuation document for a fresh agent or session. Use when the user explicitly requests a handoff, context transfer, continuation brief, or session restart.
---

# Handoff

Preserve decision state while keeping durable work in its existing source of
truth.

## Prefer an existing global skill

Inspect the skill catalog already supplied to the task. If it contains a
non-Copernicus `handoff`, follow that skill instead. Do not probe skill
directories or install anything. If no global equivalent is visible, continue
with this bundled fallback.

## Workflow

1. Inspect the current task state and authorized workspace. Use existing plans,
   ADRs, issues, commits, diffs, reports, and documentation as references.
2. Create one Markdown file in the operating system's temporary directory, not
   in the workspace. Use a private file mode when the platform supports it.
3. If the user supplied a next-session focus, make that the handoff objective.
4. Include only:
   - next mission and success condition;
   - current state, completed work, and remaining work;
   - decisions, constraints, blockers, and known risks;
   - exact paths, URLs, commits, and validation commands;
   - suggested skills for the next agent;
   - a short resume prompt.
5. Reference durable artifacts instead of copying their content. Omit noisy
   chronology and already-resolved exploration.
6. Perform a final redaction pass for credentials, tokens, cookies, private
   keys, personal data, private endpoints, and unnecessary raw logs.
7. Return the absolute temporary path and a one-sentence description.

Do not claim the handoff is durable project memory. The temporary file is a
transport artifact and may be deleted by the operating system.
