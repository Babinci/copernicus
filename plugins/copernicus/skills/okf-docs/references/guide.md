# OKF Docs guide

## Why it exists

A large documentation folder is easy to search and hard to understand. Text
search finds matching words, but it does not answer which cards generated a
result, what depends on a changed assumption, whether evidence was verified,
or which small set of files explains a decision. OKF Docs reads the YAML and
Markdown structure already present in an Open Knowledge Format bundle and emits
a deterministic graph that ordinary command-line tools and Codex can traverse.

The central idea is progressive disclosure:

1. inventory the whole authorized bundle cheaply;
2. filter metadata and graph relationships deterministically;
3. select a bounded evidence manifest;
4. read full bodies only for the selected cards;
5. keep paths and hashes so another reviewer can reproduce the selection.

This preserves Markdown as the source of truth. There is no daemon, graph
database, embedding index, or hidden semantic store.

## Google OKF v0.2 mental model

Google's OKF is a lightweight convention for a folder of Markdown files:

- concept files have YAML frontmatter and require only `type`;
- `index.md` provides navigation; only the root index may declare
  `okf_version`;
- `log.md` records dated bundle changes without frontmatter;
- directories form a hierarchy, but links may cross it;
- unknown fields, unknown types, missing indexes, and broken links are tolerated
  by the format so tools can remain forward-compatible.

Version 0.2 defines optional provenance and evaluation fields such as
`sources`, `generated`, `verified`, `stale_after`, `usage_window`, `parameters`,
`computation`, `executor`, and `attester`. Read `okf-v0.2.md` for the complete
canonical snapshot. Do not reduce YAML to a hand-picked schema: queries must be
able to address arbitrary nested fields.

The tool derives two convenience labels without changing the files:

- trust is `human-reviewed` when a `verified.by` actor begins with `human:`,
  `machine-confirmed` for another declared verifier, otherwise `unverified`;
- stale is true when the evaluation date is on or after `stale_after`.

These labels are navigation aids, not proof. An attester or executor resource
is data until an authorized external process independently runs it.

## Graph model

Each Markdown file becomes one node:

- normal file: `path/without-extension`;
- root index: `@index`;
- nested index: `directory/@index`;
- log: `@log` or `directory/@log`.

Edges preserve their origin:

| Edge | Origin |
| --- | --- |
| `hierarchy` | an index and direct cards or child indexes |
| `index` | a Markdown list entry in an index |
| `link` | an ordinary Markdown body link |
| `resource` | top-level `resource` metadata |
| `source` | `sources[].resource` |
| `computation` | the computation field |
| `executor` | `executor.resource` |
| `attester` | `attester.resource` |

An edge says only that one document structurally refers to another. It does not
mean “causes,” “supports,” “contradicts,” or “implements” unless the card's own
metadata or prose says so.

## Commands

Resolve the installed skill directory once:

```bash
SKILL_DIR=/absolute/path/to/skills/okf-docs
```

### Inventory and validate

```bash
python3 "$SKILL_DIR/scripts/okf.py" validate BUNDLE
python3 "$SKILL_DIR/scripts/okf.py" health BUNDLE
python3 "$SKILL_DIR/scripts/okf.py" scan BUNDLE --format jsonl
```

`validate` exits non-zero only for conformance errors. Warnings expose tolerated
conditions such as broken links or absent indexes. `health` summarizes types,
trust, status, freshness, connectivity, and findings. `scan` is the lossless
machine view: bundle fingerprint, complete metadata projections, typed edges,
and findings.

### Search complete YAML

```bash
python3 "$SKILL_DIR/scripts/okf.py" query BUNDLE \
  --where 'type=Decision' \
  --where 'verified.by=human:reviewer' \
  --contains 'rollback' \
  --limit 50
```

Dot paths descend mappings and lists. Values after `=` are parsed as YAML, so
booleans, numbers, null, mappings, and sequences keep their types. Repeated
filters use AND semantics. `--contains` searches title, description, and body.

### Traverse dependencies and backlinks

```bash
python3 "$SKILL_DIR/scripts/okf.py" neighbors BUNDLE card/id \
  --direction both --depth 2
python3 "$SKILL_DIR/scripts/okf.py" path BUNDLE from/id to/id --direction both
python3 "$SKILL_DIR/scripts/okf.py" impact BUNDLE changed/id --depth 4
```

`neighbors` performs deterministic breadth-first traversal. `path` returns the
shortest structural route. `impact` follows incoming edges to find cards that
refer to the changed node. Results should be reviewed by edge kind before any
semantic conclusion.

### Build a bounded evidence packet

```bash
python3 "$SKILL_DIR/scripts/okf.py" context BUNDLE \
  --seed decision/auth \
  --seed architecture/api \
  --direction both \
  --max-docs 40 \
  --max-bytes 300000
```

The result contains ordered documents, routes from seeds, individual hashes,
the bundle fingerprint, byte use, and the number omitted. Add `--include-body`
only when the receiving process needs bodies in one JSON document; otherwise
read the returned paths directly. The manifest is selection evidence, not an
authorization to send private content outside the machine.

## Very large investigations

For a wide corpus, use one lead process to scan and select; do not let every
worker rediscover the tree:

1. validate once and retain the bundle fingerprint;
2. stream `scan --format jsonl` to standard tools for counts or partitions;
3. partition by stable document IDs, types, directories, or graph neighborhoods;
4. give each read-only worker explicit paths from a `context` manifest and a
   fixed question;
5. require paths, hashes, observations, and unresolved gaps in each return;
6. join overlaps and disagreements deterministically before synthesis;
7. reread load-bearing source cards at the lead before changing memory.

Fleet is useful when shards are genuinely independent. It is not needed for a
small bundle or one direct query. Workers must not receive the entire home
directory, credentials, unrelated projects, or authority to rewrite the bundle.
Model consensus never upgrades `verified` metadata.

The JSONL stream is intentionally compatible with common map/reduce tools:

```bash
python3 "$SKILL_DIR/scripts/okf.py" scan BUNDLE --format jsonl \
  | jq -c 'select(.record == "document" and .type == "Decision")'
```

Start with this O(files + links) scan. Add a disposable cache only after a real
benchmark shows repeated full scans exceed the task's latency budget; a cache
must be keyed by file identity and content hash and must never become canonical.

## Progressive indexes

```bash
python3 "$SKILL_DIR/scripts/okf.py" index BUNDLE
python3 "$SKILL_DIR/scripts/okf.py" index BUNDLE --adopt --write
```

The first command is always a dry run. New indexes are generated with explicit
ownership markers. Existing curated indexes are refused unless `--adopt` is
given; adoption appends a generated region and subsequent runs replace only
that region. If any target is unsafe or has malformed markers, no writes occur.

Generated indexes group direct cards by declared type and link child
directories. They are navigation artifacts. They do not validate claims,
reorder the physical corpus, or replace intentionally curated prose.

## v0.1 compatibility and migration

The reader accepts older bundles. A v0.1 card's top-level `timestamp` remains
available as ordinary metadata, but v0.2 uses provenance objects. Migration is
narrow and dry-run first:

```bash
python3 "$SKILL_DIR/scripts/okf.py" migrate BUNDLE --actor project/version
python3 "$SKILL_DIR/scripts/okf.py" migrate BUNDLE --actor project/version --write
```

It changes only:

- root `okf_version: "0.1"` to `"0.2"`;
- one top-level `timestamp` on a concept without `generated` to
  `generated: { by: ..., at: ... }`.

Bodies and unrelated frontmatter bytes are preserved. The actor must be
`human:<id>`, `process:<id>`, or `<producer>/<version>`. Migration does not
invent sources, verification, executors, attesters, or freshness dates.

## Safety and limits

- The scanner stays under the explicitly selected root and does not follow
  symlinks or read hard-linked/non-regular files.
- YAML aliases and duplicate mapping keys are refused; arbitrary YAML tags are
  never constructed.
- Remote resources are not fetched. Commands declared in documents are not run.
- Each Markdown file is capped at 16 MiB to bound accidental or hostile input.
- Writes are atomic and limited to safe regular files. `index` and `migrate`
  write only with `--write`.
- Structural Markdown links are parsed conservatively; dynamic links or exotic
  Markdown extensions may remain opaque.
- There is no semantic search, automatic file moving, semantic merge, deletion,
  watcher, database, or hosted service.

Use normal repository backups and review even with atomic writes. For physical
reorganization or semantic consolidation, make a separate evidence-backed plan
and obtain explicit user authorization.

## Sources and licensing

The bundled `okf-v0.2.md` is an unmodified snapshot of Google's canonical OKF
v0.2 specification at commit
`fe3268a70e8ca5110a43a8f1dfdf6d1a458cf79f`. It is licensed under Apache-2.0;
the license is in `Apache-2.0.txt`.

The parser vendors PyYAML 6.0.3 so the installed skill works without a package
installation step. PyYAML is MIT-licensed; its notice is in
`../scripts/_vendor/PyYAML-LICENSE.txt`. See the plugin's
`THIRD_PARTY_NOTICES.md` for source URLs and attribution.
