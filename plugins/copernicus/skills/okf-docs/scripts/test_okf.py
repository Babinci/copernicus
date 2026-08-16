#!/usr/bin/env python3
"""Behavior tests for the self-contained OKF v0.2 traversal tool."""

from __future__ import annotations

import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest


SCRIPT = Path(__file__).with_name("okf.py")


class OkfToolTest(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name) / "bundle"
        self.root.mkdir()

    def tearDown(self) -> None:
        self.tmp.cleanup()

    def write(self, relative: str, text: str) -> Path:
        path = self.root / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding="utf-8")
        return path

    def run_json(self, *args: str, expected: int = 0) -> dict:
        result = subprocess.run(
            [sys.executable, str(SCRIPT), *args],
            text=True,
            capture_output=True,
            check=False,
        )
        self.assertEqual(result.returncode, expected, result.stderr or result.stdout)
        return json.loads(result.stdout)

    def make_bundle(self) -> None:
        self.write(
            "index.md",
            """---
okf_version: "0.2"
---

# Start

* [Overview](overview.md) - Entry point.
* [Metrics](metrics/) - Computed knowledge.
* [References](references/) - Source material.
""",
        )
        self.write(
            "overview.md",
            """---
type: Guide
title: Overview
description: Entry point.
tags: [root, guide]
generated: {by: process:writer, at: 2026-08-01T12:00:00Z}
verified:
  - by: process:nightly
    at: 2026-08-02T12:00:00Z
sources:
  - id: policy
    resource: /references/policy.md
    title: Policy
    author: human:maintainer
stale_after: 2026-08-15
custom:
  nested:
    - one
    - two: 2
---

Read the [revenue computation](/metrics/revenue.md) and the
[missing concept](missing.md).
""",
        )
        self.write(
            "metrics/index.md",
            """# Computations

* [Revenue](revenue.md) - Sanctioned revenue calculation.
""",
        )
        self.write(
            "metrics/revenue.md",
            """---
type: Attested Computation
title: Revenue
description: Sanctioned revenue calculation.
status: stable
runtime: python
parameters:
  - {name: year, type: integer, required: true}
executor:
  resource: /references/run-revenue.md
  receipt: [year, result]
attester:
  resource: /references/check-revenue.md
verified: {by: human:owner, at: 2026-08-10T10:00:00Z}
---

# Computation

```python
result = year * 2
```
""",
        )
        self.write(
            "references/index.md",
            """# References

* [Policy](policy.md) - Governing policy.
* [Runner](run-revenue.md) - Run instructions.
* [Attester](check-revenue.md) - Deterministic check.
""",
        )
        for name, title in (
            ("policy", "Policy"),
            ("run-revenue", "Runner"),
            ("check-revenue", "Attester"),
        ):
            self.write(
                f"references/{name}.md",
                f"""---
type: Reference
title: {title}
---

# {title}
""",
            )

    def test_scan_parses_full_yaml_and_builds_structural_graph(self) -> None:
        self.make_bundle()
        scan = self.run_json("scan", str(self.root), "--today", "2026-08-16")
        docs = {doc["id"]: doc for doc in scan["documents"]}
        self.assertEqual(scan["okf_version"], "0.2")
        self.assertEqual(docs["overview"]["metadata"]["custom"]["nested"][1]["two"], 2)
        self.assertEqual(docs["overview"]["trust"], "machine-confirmed")
        self.assertTrue(docs["overview"]["stale"])
        self.assertEqual(docs["metrics/revenue"]["trust"], "human-reviewed")
        edges = {(edge["source"], edge["target"], edge["kind"]) for edge in scan["edges"]}
        self.assertIn(("@index", "overview", "index"), edges)
        self.assertIn(("overview", "metrics/revenue", "link"), edges)
        self.assertIn(("overview", "references/policy", "source"), edges)
        self.assertIn(("metrics/revenue", "references/run-revenue", "executor"), edges)
        self.assertIn(("metrics/revenue", "references/check-revenue", "attester"), edges)

    def test_validation_is_permissive_but_enforces_conformance(self) -> None:
        self.make_bundle()
        self.write("bad.md", "---\ntitle: Missing type\n---\n\nBody.\n")
        result = self.run_json("validate", str(self.root), expected=1)
        self.assertFalse(result["ok"])
        codes = {(item["level"], item["code"], item["path"]) for item in result["findings"]}
        self.assertIn(("error", "missing-type", "bad.md"), codes)
        self.assertIn(("warning", "broken-link", "overview.md"), codes)

    def test_query_and_graph_traversal_remain_deterministic(self) -> None:
        self.make_bundle()
        query = self.run_json(
            "query", str(self.root), "--where", "custom.nested.two=2"
        )
        self.assertEqual([item["id"] for item in query["documents"]], ["overview"])

        path = self.run_json(
            "path", str(self.root), "@index", "metrics/revenue"
        )
        self.assertEqual(path["path"], ["@index", "metrics/@index", "metrics/revenue"])

        neighbors = self.run_json(
            "neighbors", str(self.root), "overview", "--direction", "out", "--depth", "1"
        )
        self.assertIn("metrics/revenue", [item["id"] for item in neighbors["documents"]])

        impact = self.run_json("impact", str(self.root), "metrics/revenue")
        self.assertIn("overview", [item["id"] for item in impact["documents"]])

    def test_context_is_budgeted_and_explains_each_route(self) -> None:
        self.make_bundle()
        context = self.run_json(
            "context",
            str(self.root),
            "--seed",
            "overview",
            "--max-docs",
            "3",
            "--max-bytes",
            "100000",
        )
        self.assertEqual(context["documents"][0]["id"], "overview")
        self.assertLessEqual(len(context["documents"]), 3)
        self.assertEqual(context["documents"][0]["route"], [])
        self.assertTrue(all("sha256" in item for item in context["documents"]))
        self.assertGreater(context["omitted_count"], 0)

    def test_scan_refuses_symlink_traversal(self) -> None:
        self.make_bundle()
        outside = Path(self.tmp.name) / "outside.md"
        outside.write_text("---\ntype: Secret\n---\n", encoding="utf-8")
        (self.root / "escape.md").symlink_to(outside)
        scan = self.run_json("scan", str(self.root))
        self.assertNotIn("escape", [item["id"] for item in scan["documents"]])
        self.assertIn("symlink-refused", [item["code"] for item in scan["findings"]])

    def test_index_is_dry_run_marker_owned_and_idempotent(self) -> None:
        self.write("topic.md", "---\ntype: Concept\ntitle: Topic\ndescription: One topic.\n---\n\nBody.\n")
        plan = self.run_json("index", str(self.root))
        self.assertFalse((self.root / "index.md").exists())
        self.assertEqual(plan["changes"][0]["action"], "create")

        self.run_json("index", str(self.root), "--write")
        generated = (self.root / "index.md").read_text(encoding="utf-8")
        self.assertIn("<!-- okf-docs:generated:start -->", generated)
        self.assertIn("* [Topic](topic.md) - One topic.", generated)
        second = self.run_json("index", str(self.root))
        self.assertEqual(second["changes"], [])

        curated = "# Curated\n\nHuman order.\n"
        (self.root / "index.md").write_text(curated, encoding="utf-8")
        refused = self.run_json("index", str(self.root), "--write", expected=2)
        self.assertEqual(refused["changes"][0]["action"], "refuse")
        self.assertEqual((self.root / "index.md").read_text(encoding="utf-8"), curated)
        self.run_json("index", str(self.root), "--write", "--adopt")
        self.assertTrue((self.root / "index.md").read_text(encoding="utf-8").startswith(curated))

        outside = Path(self.tmp.name) / "outside-index.md"
        outside.write_text("outside must not be read or changed\n", encoding="utf-8")
        (self.root / "index.md").unlink()
        (self.root / "index.md").symlink_to(outside)
        unsafe = self.run_json("index", str(self.root), "--adopt", "--write", expected=2)
        self.assertEqual(unsafe["changes"][0]["action"], "refuse")
        self.assertEqual(outside.read_text(encoding="utf-8"), "outside must not be read or changed\n")

    def test_migration_is_dry_run_byte_preserving_and_idempotent(self) -> None:
        original_body = "# Body\n\nKeep this exactly.\n"
        self.write("index.md", "---\nokf_version: \"0.1\"\n---\n\n# Old\n")
        self.write(
            "legacy.md",
            "---\ntype: Concept\ntitle: Legacy\ntimestamp: 2026-08-01T12:00:00Z\ncustom: {keep: yes}\n---\n\n"
            + original_body,
        )
        before = (self.root / "legacy.md").read_bytes()
        dry = self.run_json(
            "migrate", str(self.root), "--actor", "copernicus/okf-docs"
        )
        self.assertEqual(len(dry["changes"]), 2)
        self.assertEqual((self.root / "legacy.md").read_bytes(), before)

        self.run_json(
            "migrate", str(self.root), "--actor", "copernicus/okf-docs", "--write"
        )
        migrated = (self.root / "legacy.md").read_text(encoding="utf-8")
        self.assertIn('generated: { by: "copernicus/okf-docs", at: 2026-08-01T12:00:00Z }', migrated)
        self.assertIn("custom: {keep: yes}", migrated)
        self.assertTrue(migrated.endswith(original_body))
        again = self.run_json(
            "migrate", str(self.root), "--actor", "copernicus/okf-docs"
        )
        self.assertEqual(again["changes"], [])

    def test_jsonl_output_is_partitionable_for_wide_fleet_work(self) -> None:
        self.make_bundle()
        result = subprocess.run(
            [sys.executable, str(SCRIPT), "scan", str(self.root), "--format", "jsonl"],
            text=True,
            capture_output=True,
            check=False,
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        rows = [json.loads(line) for line in result.stdout.splitlines()]
        self.assertEqual(rows[0]["record"], "bundle")
        self.assertIn("document", {row["record"] for row in rows})
        self.assertIn("edge", {row["record"] for row in rows})


if __name__ == "__main__":
    unittest.main()
