# SAS and OKF contracts

## Run bundle

```text
run/
  index.md               navigation
  problem.md             frozen problem concept
  graph.json             adaptive role DAG
  evidence.jsonl         locally append-only hash chain
  candidates/            content-addressed artifacts
  knowledge/
    index.md             OKF navigation
    log.md               material curation history
    *.md                 one concept per card
```

## Graph

`graph.json` uses `copernicus.graph.v1`:

```json
{
  "schema_version": "copernicus.graph.v1",
  "status": "ready",
  "problem_sha256": "sha256:...",
  "budgets": {"max_seats": 5, "max_cycles": 2},
  "nodes": [
    {
      "id": "map-sources",
      "role": "Map primary evidence",
      "lane": "luna",
      "depends_on": [],
      "input": "problem.md and named source paths",
      "output": "claims.json",
      "authority": "advisory evidence map only",
      "verifier": "sample claims against primary sources",
      "falsifier": "a cited source contradicts a mapped claim",
      "status": "pending"
    }
  ]
}
```

The graph must be acyclic. `draft` graphs may be empty; `ready` graphs may not. Model nodes do not control the graph, widen the fleet, certify themselves, or authorize external actions.

## Evidence receipt

Input receipts require:

```json
{
  "record_id": "cycle-001-candidate-001",
  "kind": "candidate",
  "source": "candidates/sha256-abc/artifact",
  "falsifier": "authoritative evaluator rejects the artifact",
  "payload": {}
}
```

Allowed kinds are `regime`, `card_selection`, `candidate`, `evaluation`, `review`, `cycle_join`, and `card_disposition`. The receipt tool adds `observed_at`, `previous_record_sha256`, and `record_sha256`, rejects duplicate IDs, and fsyncs the append. The `source` field is an operator-supplied identifier; retain and verify the named artifact separately. The log detects edits and broken links in its retained chain, but a valid-prefix truncation requires an external retained head or signed release to detect.

## Candidate identity

Hash canonical JSON containing:

```text
regime hash
parent candidate hash or null
changed hypothesis
prompt or strategy hash
ordered selected-card IDs and hashes
artifact hash
```

A different field means a different candidate. Identical bytes and context are not a new experiment.

## Cycle-boundary memory

A card disposition needs joined evaluation evidence. Promotion also needs an explicit falsifier and evidence that the card changed a decision or outcome; file existence and model agreement are insufficient. Quarantine off-regime knowledge instead of silently treating it as current.
