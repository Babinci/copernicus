---
name: auto-research
description: Run a general Solution Autoresearch System (SAS) with an adaptive GPT-only agent graph, deterministic evaluation, a locally integrity-checked evidence log, and Open Knowledge Format (OKF) memory. Use for hard problem solving, invention loops, research campaigns, repeated optimization, hypothesis search, or any task where agents should learn across measured cycles without turning guesses into memory.
---

# Copernicus Auto-Research

SAS is the invention loop. OKF is its memory layer. Build the smallest graph the actual problem needs; do not import a standing agent society.

## Start

1. Write the user's problem and acceptance test into a plain Markdown file.
2. Create a run bundle:

```bash
python3 scripts/receipts.py init RUN_DIR --problem PROBLEM.md --title "Short title"
```

3. Read [contracts.md](references/contracts.md). Fill `graph.json`, set its status to `ready`, and run:

```bash
python3 scripts/receipts.py verify RUN_DIR
```

## Invent the graph

Freeze the problem regime before choosing agents: objective, inputs, evaluator, constraints, budget, freshness boundary, and stop conditions. Then create only roles that change a named artifact or decision.

Every node must declare:

- bounded input and typed output;
- lane: `deterministic`, `sol`, `terra`, `luna`, or `human`;
- dependencies;
- authority ceiling;
- independent verifier;
- falsifier;
- terminal status.

Prefer deterministic controller/evaluator nodes. Use models as bounded mappers, proposers, critics, implementers, or curators. A role need not be a separate agent. Delete any role that does not change a named artifact or decision.

## Run one cycle

1. Snapshot the regime and append a `regime` receipt.
2. Select applicable OKF cards deterministically and record their IDs plus file hashes. Baselines record an explicit empty-card receipt.
3. Execute ready graph nodes through the `fleet` skill. Run independent nodes in parallel and dependency edges in order.
4. Make each candidate content-addressed. Bind it to the regime, parent candidate, changed hypothesis, prompt/strategy identity, selected card hashes, and artifact hash.
5. Run the cheapest trusted filter first, then the authoritative evaluator, then an independent semantic or normative review when correctness is broader than a test result.
6. Retry only when the failure signature and hypothesis changed. Never retry identical candidate bytes or prompts.
7. Join candidate, evaluation, review, and cost evidence into one `cycle_join` receipt.
8. Only at the cycle boundary, promote, reject, quarantine, or retire an OKF card. A hypothesis never promotes itself.

Append each receipt from a JSON object:

```bash
python3 scripts/receipts.py append RUN_DIR/evidence.jsonl receipt.json
python3 scripts/receipts.py verify RUN_DIR
```

## OKF memory

Keep one concept per Markdown file with YAML frontmatter. Start with only three card families:

- `selection`: what is worth attempting;
- `strategy`: what change is likely to help;
- `risk`: what can invalidate or mislead the evaluation.

Cards require evidence, regime scope, a falsifier, and a disposition. New domains may rename these concepts, but do not add a fourth family until a measured workflow cannot fit one of the three.

Use relative Markdown links and keep `knowledge/index.md` as progressive navigation. Update `knowledge/log.md` only for material curation changes.

## Stop rules

Stop and report rather than guessing when the evaluator is missing, the regime changed, evidence cannot be joined, a provider/model is unavailable, the same failure repeats, or the budget is exhausted. Stop for user authority before purchases, publishing, deployment, messaging, signing, secrets, or destructive/external mutations.

Do not add a graph database, vector store, agent genome, role league, custom queue, dashboard, daemon, or second state store until a measured run proves the flat graph, files, and JSONL ledger insufficient.
