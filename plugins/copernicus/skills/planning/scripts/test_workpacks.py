#!/usr/bin/env python3

from __future__ import annotations

import contextlib
import importlib.util
import io
from pathlib import Path
import tempfile
import unittest


SCRIPT = Path(__file__).with_name("workpacks.py")
SPEC = importlib.util.spec_from_file_location("workpacks", SCRIPT)
workpacks = importlib.util.module_from_spec(SPEC)
assert SPEC.loader
SPEC.loader.exec_module(workpacks)


def run(*args: str) -> tuple[int, str, str]:
    stdout, stderr = io.StringIO(), io.StringIO()
    with contextlib.redirect_stdout(stdout), contextlib.redirect_stderr(stderr):
        result = workpacks.main(list(args))
    return result, stdout.getvalue(), stderr.getvalue()


def complete(path: Path, replacements: dict[str, str]) -> None:
    text = path.read_text()
    for old, new in replacements.items():
        text = text.replace(old, new)
    path.write_text(text)


class WorkpackTest(unittest.TestCase):
    def test_init_validate_index_and_next(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            bundle = Path(temporary) / "plan"
            self.assertEqual(run("init", str(bundle), "--title", "Ship outcome")[0], 0)
            self.assertEqual(run("validate", str(bundle))[0], 0)
            self.assertIn(workpacks.GENERATED, (bundle / "index.md").read_text())
            self.assertEqual(run("next", str(bundle))[1].strip(), "none")

    def test_implementation_ready_requires_materialized_tests(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            bundle = root / "plan"
            run("init", str(bundle), "--title", "Ship outcome")
            complete(
                bundle / "design.md",
                {
                    "status: draft": "status: ready",
                    "[replace with the observable design outcome]": "Deliver verified behavior.",
                    "[replace with source-of-truth and freshness boundary]": "Repository source at planning time.",
                    "[replace with user-visible behavior and observable success]": "Users observe the result.",
                    "[replace with observed facts, citations, and UNVERIFIED gaps]": "Observed source and tests are cited.",
                    "[replace with the smallest coherent solution]": "Reuse the existing boundary.",
                    "[replace with exact paths, interfaces, ownership, and authority limits]": "One existing interface changes.",
                    "[replace with chosen option, rejected alternatives, and reversal trigger]": "Direct edit wins; revert on regression.",
                    "[replace with failure modes, prevention, rollback, and stop conditions]": "Tests gate the change and git reverts it.",
                    "[replace with deliberately excluded work]": "No new framework.",
                },
            )
            complete(
                bundle / "workpacks/WP-001.md",
                {
                    "title: \"[replace with one independently verifiable deliverable]\"": 'title: "Enforce behavior"',
                    "description: \"[replace with the workpack outcome]\"": 'description: "Deliver tested behavior."',
                    "status: draft": "status: ready",
                    "test_paths: []": 'test_paths: ["tests/test_feature.py"]',
                    "paths: []": 'paths: ["src/feature.py"]',
                    "# WP-001 — [replace title]": "# WP-001 — Enforce behavior",
                    "[replace with observable result]": "The behavior is observable.",
                    "[replace with source evidence, freshness, assumptions, and UNVERIFIED gaps]": "Current source is the authority.",
                    "[replace with owned paths/interfaces and explicit non-goals]": "Own one source path; no unrelated edits.",
                    "[replace with test cases, exact test paths, command, and expected red result]": "The focused test fails before implementation.",
                    "[replace with ordered minimal edits, named symbols, and reuse points]": "Change the existing function only.",
                    "[replace with exact commands, expected outputs, and requirement-to-test mapping]": "Run the focused test; expect pass.",
                    "[replace with falsifier, rollback, blockers, and new-authority boundary]": "Stop on unrelated regression; revert the edit.",
                    "[replace with prerequisites, completion evidence, and next consumer]": "Attach test output for the implementer.",
                },
            )
            result, _, error = run(
                "validate", str(bundle), "--implementation-ready", "--repo-root", str(root)
            )
            self.assertEqual(result, 1)
            self.assertIn("missing confined test file", error)
            (root / "tests").mkdir()
            (root / "tests/test_feature.py").write_text("def test_feature():\n    assert True\n")
            result, _, error = run(
                "validate", str(bundle), "--implementation-ready", "--repo-root", str(root)
            )
            self.assertEqual(result, 0, error)
            self.assertEqual(run("next", str(bundle))[1].strip(), "WP-001")

    def test_cycle_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            bundle = Path(temporary) / "plan"
            run("init", str(bundle), "--title", "Cycle")
            first = bundle / "workpacks/WP-001.md"
            first.write_text(first.read_text().replace("depends_on: []", 'depends_on: ["WP-002"]'))
            second = bundle / "workpacks/WP-002.md"
            second.write_text(
                first.read_text()
                .replace("id: WP-001", "id: WP-002")
                .replace("# WP-001", "# WP-002")
                .replace('depends_on: ["WP-002"]', 'depends_on: ["WP-001"]')
            )
            result, _, error = run("validate", str(bundle))
            self.assertEqual(result, 1)
            self.assertIn("dependency cycle", error)

    def test_unsafe_and_parallel_conflicting_paths_are_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            bundle = Path(temporary) / "plan"
            run("init", str(bundle), "--title", "Paths")
            first = bundle / "workpacks/WP-001.md"
            first.write_text(first.read_text().replace("paths: []", 'paths: ["../escape"]'))
            self.assertIn("unsafe paths path", run("validate", str(bundle))[2])
            first.write_text(first.read_text().replace('paths: ["../escape"]', 'paths: ["src/shared.py"]'))
            second = bundle / "workpacks/WP-002.md"
            second.write_text(first.read_text().replace("id: WP-001", "id: WP-002").replace("# WP-001", "# WP-002"))
            result, _, error = run("validate", str(bundle))
            self.assertEqual(result, 1)
            self.assertIn("share paths without a dependency", error)

    def test_index_refuses_to_overwrite_human_content(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            bundle = Path(temporary) / "plan"
            run("init", str(bundle), "--title", "Index")
            (bundle / "index.md").write_text("# Human index\n")
            result, _, error = run("index", str(bundle), "--write")
            self.assertEqual(result, 1)
            self.assertIn("refusing to overwrite", error)

    def test_ambiguous_workpack_metadata_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            bundle = Path(temporary) / "plan"
            run("init", str(bundle), "--title", "Metadata")
            workpack = bundle / "workpacks/WP-001.md"

            original = workpack.read_text()
            today = workpacks.date.today().isoformat()
            workpack.write_text(original.replace(f'updated: "{today}"', 'updated: "later"'))
            self.assertIn("updated must be an ISO date", run("validate", str(bundle))[2])

            workpack.write_text(original.replace('test_waiver: ""', 'test_waiver: "Use an integration probe."'))
            self.assertIn("cannot also declare a test_waiver", run("validate", str(bundle))[2])

            workpack.write_text(original)
            workpack.rename(workpack.with_name("WP-002.md"))
            self.assertIn("filename must match workpack id", run("validate", str(bundle))[2])


if __name__ == "__main__":
    unittest.main()
