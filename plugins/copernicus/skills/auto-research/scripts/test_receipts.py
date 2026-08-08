import importlib.util
import json
from pathlib import Path
import tempfile
import unittest


MODULE_PATH = Path(__file__).with_name("receipts.py")
SPEC = importlib.util.spec_from_file_location("copernicus_receipts", MODULE_PATH)
receipts = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(receipts)


class ReceiptsTest(unittest.TestCase):
    def create_run(self, root: Path) -> Path:
        problem = root / "input.md"
        problem.write_text("Find a smaller, verified solution.")
        run = root / "run"
        receipts.initialize(run, problem, "Fixture")
        return run

    def test_init_append_and_verify(self):
        with tempfile.TemporaryDirectory() as directory:
            run = self.create_run(Path(directory))
            self.assertEqual(receipts.verify_bundle(run), [])
            record = receipts.validate_record(
                {
                    "record_id": "cycle-001-regime",
                    "kind": "regime",
                    "source": "problem.md",
                    "falsifier": "problem contract changes",
                    "payload": {"status": "frozen"},
                }
            )
            sealed = receipts.append_record(run / "evidence.jsonl", record)
            self.assertTrue(sealed["record_sha256"].startswith("sha256:"))
            self.assertEqual(receipts.verify_bundle(run), [])
            with self.assertRaisesRegex(receipts.ReceiptError, "duplicate record_id"):
                receipts.append_record(run / "evidence.jsonl", record)

    def test_tamper_and_cycle_are_detected(self):
        with tempfile.TemporaryDirectory() as directory:
            run = self.create_run(Path(directory))
            graph_path = run / "graph.json"
            graph = json.loads(graph_path.read_text())
            node = {
                "id": "loop",
                "role": "Bad loop",
                "lane": "terra",
                "depends_on": ["loop"],
                "input": "problem",
                "output": "none",
                "authority": "none",
                "verifier": "none",
                "falsifier": "cycle exists",
                "status": "pending",
            }
            graph.update(status="ready", nodes=[node])
            graph_path.write_text(json.dumps(graph))
            self.assertTrue(any("graph cycle" in error for error in receipts.verify_bundle(run)))

            graph.update(status="draft", nodes=[])
            graph_path.write_text(json.dumps(graph))
            record = {
                "record_id": "r1",
                "kind": "regime",
                "source": "problem.md",
                "falsifier": "changed",
                "payload": {},
            }
            receipts.append_record(run / "evidence.jsonl", record)
            ledger = run / "evidence.jsonl"
            ledger.write_text(ledger.read_text().replace('"kind": "regime"', '"kind": "review"'))
            self.assertTrue(any("record hash mismatch" in error for error in receipts.verify_bundle(run)))

    def test_budget_and_broken_okf_link_are_detected(self):
        with tempfile.TemporaryDirectory() as directory:
            run = self.create_run(Path(directory))
            graph_path = run / "graph.json"
            graph = json.loads(graph_path.read_text())
            node = {
                "id": "one",
                "role": "Map",
                "lane": "luna",
                "depends_on": [],
                "input": "problem",
                "output": "claims",
                "authority": "advisory",
                "verifier": "source check",
                "falsifier": "source conflict",
                "status": "pending",
            }
            graph.update(status="ready", budgets={"max_seats": 1, "max_cycles": 1}, nodes=[node, {**node, "id": "two"}])
            graph_path.write_text(json.dumps(graph))
            card = run / "knowledge" / "risk.md"
            card.write_text("---\ntype: risk\n---\n\n[Missing](missing.md)\n")
            outside = run.parent / "outside.md"
            outside.write_text("not part of the bundle")
            escape = run / "knowledge" / "escape.md"
            escape.write_text("---\ntype: risk\n---\n\n[Outside](../../outside.md)\n")
            errors = receipts.verify_bundle(run)
            self.assertIn("graph nodes exceed max_seats", errors)
            self.assertTrue(any("broken Markdown link" in error for error in errors))
            self.assertTrue(any("escaping Markdown link" in error for error in errors))


if __name__ == "__main__":
    unittest.main()
