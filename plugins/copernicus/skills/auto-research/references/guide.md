# Copernicus Auto-Research explained

## Why it exists

Hard problems rarely fail because no ideas were generated. They fail because
the problem changed unnoticed, candidates were compared under different rules,
model confidence replaced evaluation, or attractive guesses entered memory as
facts.

Auto-Research supplies a small scientific loop for problem solving. It freezes
the current problem regime, invents only the roles the problem needs, evaluates
content-addressed candidates, records what happened, and updates durable
knowledge only after the evidence joins at a cycle boundary.

## The essence

```text
freeze the question and evaluator
  -> invent a bounded dependency graph
  -> select relevant prior knowledge
  -> create a candidate with one named change
  -> filter and evaluate
  -> challenge broader correctness when needed
  -> join evidence
  -> curate durable knowledge
```

SAS is the execution loop. OKF is the durable memory format. The execution graph
is temporary; the knowledge graph is plain linked Markdown.

## Core concepts

### Regime

The exact objective, inputs, constraints, evaluator, budget, freshness boundary,
and stop conditions for one cycle. If any material part changes, start a new
regime rather than comparing unlike results.

### Agent graph

A small acyclic graph of roles and dependencies. Roles are invented for the
problem, but every node must name its input, output, authority, verifier,
falsifier, lane, and terminal state. A node is useful only when it changes a
named artifact or decision.

### Candidate

A proposed solution bound to the regime, its parent, the changed hypothesis,
selected knowledge cards, prompt or strategy identity, and artifact hash. The
same bytes and context are the same experiment, not a new attempt.

### Evaluator

The most authoritative available test of success: a test suite, benchmark,
measurement, source comparison, rubric, or human decision. Commands and trusted
measurements outrank model opinion.

### Falsifier

A concrete observation that would invalidate a claim or candidate. Without a
falsifier, the system cannot distinguish learning from storytelling.

### Receipt

A canonical JSON record describing a regime, candidate, evaluation, review,
join, or knowledge disposition. Receipt hashes form a locally integrity-checked
chain.

### OKF card

One durable Markdown concept with frontmatter, evidence, scope, falsifier, and
disposition. Copernicus starts with three families:

- `selection`: what is worth attempting;
- `strategy`: what change is likely to help;
- `risk`: what could invalidate or mislead the evaluation.

## What it does

- Creates a portable run bundle of Markdown, JSON, and JSONL files.
- Validates graph shape, budgets, dependencies, and cycles.
- Gives every candidate a reproducible identity.
- Separates cheap filters, authoritative evaluation, and broader review.
- Detects edits and broken links in the retained receipt chain.
- Preserves durable learning as human-readable OKF cards.
- Stops rather than promoting knowledge when evidence cannot be joined.

## What it does not do

- It does not invent an evaluator the user does not have.
- It does not make a model the controller, judge, and memory curator.
- It does not treat a successful command as proof of every semantic or policy
  claim around the artifact.
- It does not automatically publish, deploy, purchase, message, or mutate an
  external system.
- It does not require a graph database, vector store, daemon, or hosted memory.

## A complete cycle

1. Write the problem and acceptance test.
2. Initialize the run bundle with `scripts/receipts.py init`.
3. Freeze and record the regime.
4. Create the smallest useful `graph.json` and verify it.
5. Select relevant cards by scope and hash; record an explicit empty selection
   for a baseline.
6. Execute ready nodes sequentially or through sibling `$fleet`.
7. Create one content-addressed candidate per meaningful hypothesis change.
8. Run the cheapest trusted filter, then the authoritative evaluator.
9. Add an independent review only when correctness exceeds the evaluator.
10. Join candidate, evaluation, review, and cost evidence.
11. Promote, reject, quarantine, or retire knowledge at the cycle boundary.
12. Verify the bundle and report supported, contradicted, and unverified claims.

## Expected output

```text
run/
  problem.md
  graph.json
  evidence.jsonl
  candidates/
  knowledge/
    index.md
    log.md
    *.md
```

The human-facing summary should state the frozen regime, graph, evaluated
candidates, winning or blocked result, evidence gaps, cost, and proposed memory
changes. A proposal is not accepted memory until its disposition is explicit.

## Generic examples

### Improve a build pipeline

Freeze the repository revision, build command, benchmark hardware, time metric,
and correctness tests. Let Luna map bottlenecks, Terra implement one bounded
change, deterministic commands measure it, and Sol review only cross-cutting
risk. Promote a strategy card only when the measured cycle changed the outcome.

### Research a policy question

Freeze jurisdiction, effective date, source policy, decision rubric, and allowed
sources. Map primary evidence, challenge conflicts, join citations, and keep any
unsupported conclusion `UNVERIFIED`. A model summary never outranks the primary
source.

### Choose a product direction

Freeze user segment, decision horizon, constraints, evidence sources, and a
scoring rubric. Use `$rick-rubin` before the graph to remove weak options, then
evaluate the remaining candidates. Record risks separately from strategies.

## Self-contained and privacy boundary

The skill contains its graph contract, receipt tool, tests, and explanatory
guide. The receipt tool uses only Python's standard library and writes inside
the run directory chosen by the user. Parallel execution is optional; the
method still works sequentially without Fleet.

No private repository, internal ontology, hosted database, undisclosed prompt,
or external memory service is required. Users provide their own problem,
materials, evaluator, and authorization boundary.

## Honest limitations

- The receipt chain detects edits to the retained chain, not deletion to a
  still-valid prefix. Detecting truncation requires an externally retained head
  or signed release.
- The `source` field is an operator-supplied identifier; retain and validate the
  actual artifact separately.
- A poor evaluator produces poor learning even when every receipt is valid.
- OKF curation is intentionally explicit. Automatic promotion would turn one
  weak cycle into durable contamination.
