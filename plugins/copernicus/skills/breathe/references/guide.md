# Breathe explained

## Why it exists

Deep agent work and human decision-making operate at different bandwidths.
Fleet can inspect many evidence slices, but forwarding every worker answer to a
person merely transfers the coordination burden. A short generic summary is
also insufficient: it often erases disagreement, uncertainty, provenance, and
the consequences of choosing one path.

Breathe makes the human decision boundary the design constraint. It spends
machine attention between checkpoints, then returns the smallest representation
that is sufficient for the next real decision.

## The autoencoder analogy

The analogy is useful if its limits stay explicit:

```text
map waves -> typed claims -> semantic reduction -> verified decision state
                                                     |
                                              decision brief
                                                     |
                              expansion handles -> evidence and roster
```

- **Encoder:** Luna seats map distinct evidence and express it through one
  claim schema.
- **Bottleneck:** reducers retain only information that changes a decision,
  confidence, priority, risk, or next action.
- **Decoder:** stable handles reopen the supporting evidence, dissent, or
  worker trace on demand.

This is not a learned neural autoencoder and it does not use embeddings.
Compression is acceptable only while important claims remain traceable and
expandable. The brief is deliberately lossy about repetition and process, but
not about material uncertainty or evidence.

## The operating loop

```mermaid
flowchart LR
  F["Frame decision"] --> I["Deterministic inventory"]
  I --> M["Luna map wave ≤5"]
  M --> R["Terra reduction"]
  R --> V["Independent verification"]
  V --> B["Decision brief"]
  R -->|"decision-changing gap + budget"| M
  B -->|"human decision"| F
  B -->|"explicit feedback enum"| E["Private experience ledger"]
  E --> F
```

The lead, not a worker, owns recursion. “Respawn” means creating another
bounded wave for a named evidence gap. It never means allowing leaf agents to
create an uncontrolled tree.

## What the brief optimizes

A good Breathe brief minimizes time-to-sound-decision, not word count alone. It
must answer:

1. What became true enough to act on?
2. What choice is needed now, if any?
3. What does the recommended choice gain, risk, and postpone?
4. Which uncertainty or dissent could still reverse it?
5. What will continue without another interruption?
6. How can the user reopen any compressed claim?

The default asks for at most three decisions because a longer list is usually a
planning document masquerading as a checkpoint. When no decision is needed,
say so and continue autonomously inside the existing authority boundary.

## Experience without surveillance

Breathe improves briefing style from explicit interaction signals. For
example, repeatedly expanding `risks` suggests that risks should receive more
space by default; repeated `too-detailed` feedback suggests tighter briefs.
Choosing “no” on a project recommendation is not a briefing-quality signal and
must not enter the ledger.

The ledger deliberately cannot store notes. Its vocabulary is finite, its file
is private, and fewer than three samples do not alter defaults. This avoids
turning user projects, conversations, or decisions into an accidental personal
dataset. The user can inspect the exact aggregate with `experience.py summary`
and override its location with `COPERNICUS_BREATHE_EXPERIENCE_FILE`.

“Auto-improve” therefore means adapting presentation emphasis from explicit
feedback. It does not mean silently editing `SKILL.md`, changing safety rules,
promoting model prose to memory, or training a model.

## Example invocation

```text
Use $breathe to investigate whether this service should be split before the
next release. Work autonomously through at most three five-seat Luna map waves.
Interrupt me only if the evidence requires a product or migration-risk choice.
Return a decision brief under 350 words with expandable evidence handles.
```

## Relationship to the other Copernicus skills

- `$rick-rubin` reduces speculative branches before investigation.
- `$fleet` owns GPT routing, worker execution, wave limits, and rosters.
- `$breathe` owns iterative gap-driven reduction and the human checkpoint.
- `$auto-research` owns evaluated experiment cycles and proposed OKF memory.
- `$html-report` turns authorized results into a durable reader artifact when a
  conversation brief is not enough.

## Honest limitations

- Luna seats are correlated and do not create independent truth.
- A compact brief can still frame the wrong decision; the trace makes that
  framing inspectable but does not eliminate judgment.
- Model availability and plan capacity belong to the signed-in Codex account.
- Preference counts are a tiny heuristic, not a learned user model.
- Breathe does not authorize external actions or make an unattended agent safe
  merely by reducing how often it speaks to the user.
