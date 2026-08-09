# Rick Rubin subtraction explained

## Why it exists

Generating ideas is cheap. Choosing what deserves attention is harder. Plans,
products, research graphs, codebases, and documents accumulate plausible pieces
that survive because someone already built them, not because they still serve
the outcome.

This skill creates a deliberate convergence pass. It asks what remains true
when each part disappears and requires every surviving part to earn its weight.

## The essence

```text
name the essential outcome
  -> allow ideas when divergence is still needed
  -> test each part by subtraction
  -> preserve what carries the outcome
  -> make the hardest defensible cut
```

Less-but-better is not “make everything small.” It is “remove everything that
does not strengthen the essence.” A larger solution can survive when its parts
carry real load; a tiny solution can still fail when it removes necessary
evidence, safety, accessibility, or reliability.

## What it does

- Identifies the essential user-visible outcome.
- Separates load-bearing parts from ornamental or speculative parts.
- Challenges sunk cost, unused flexibility, duplicated explanation, and layers
  that exist only to manage other layers.
- Produces an explicit cut list rather than vague advice to simplify.
- Preserves uncertainty by naming the hardest cut.
- Reduces a divergent brainstorm before expensive evaluation begins.

## What it does not do

- It does not remove validation, security, accessibility, or data-loss
  protection merely to reduce line count.
- It does not replace evidence with taste.
- It does not imitate a living person's voice, biography, or private method.
- It does not decide external actions for the user.

## The subtraction test

For every component, claim, role, feature, document, or idea, ask:

1. What user-visible outcome does this carry?
2. What breaks if it disappears?
3. Is that break observed, required, or merely imagined?
4. Does an existing part already carry the same load?
5. Could a platform feature, standard library, direct sentence, or direct
   decision replace it?
6. Is it here because it works, or because effort has already been spent?

Keep the part only when its removal causes a material, evidenced loss.

## Expected output

```text
ESSENCE
One sentence naming the outcome.

WHAT STAYS
- part — load it carries

WHAT GOES
- part — simpler surviving replacement

HARDEST CUT
- uncertain cut — why removing it is still the better decision
```

When evidence is incomplete, label the cut reversible or propose the cheapest
test that would settle it.

## Generic examples

### Product brainstorm

Start with all ideas. Remove those that do not serve the named user and moment.
Merge duplicates. Send only the strongest candidates into `$auto-research` for
evaluation.

### Agent graph

Remove any role that does not change a named artifact or decision. A role title
is not evidence that a separate agent is needed. Preserve independent
verification because it carries correctness, not ceremony.

### Codebase

Remove an interface with one implementation, speculative configuration, unused
dependencies, duplicated wrappers, and documentation that merely restates the
code. Preserve boundary validation and the smallest runnable regression check.

### Document

Name the decision the reader must make. Remove background that does not change
that decision, merge repeated claims, and move necessary evidence next to the
claim it supports.

## Relationship to other Copernicus skills

Use `$rick-rubin` before `$fleet` to avoid paying multiple seats to analyze weak
branches. Use it before `$auto-research` to reduce the candidate set. Use it
after a research cycle to cut mechanisms that evidence shows are unnecessary.

It never acts as the evaluator. Subtraction proposes what to remove; tests,
sources, measurements, or human judgment decide whether the cut is safe.

## Self-contained and privacy boundary

This skill is prompt-only. It has no scripts, network calls, credentials,
private project assumptions, or external dependencies. It operates only on the
material the user provides or authorizes Codex to inspect.

## Honest limitations

- Subtraction is judgment, not proof.
- The method can over-cut when the essential outcome is vague.
- Hidden operational, safety, or accessibility requirements must be surfaced
  before removal.
- Reversible cuts are preferable when evidence is weak.
