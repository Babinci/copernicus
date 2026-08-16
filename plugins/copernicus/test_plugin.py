#!/usr/bin/env python3
"""Small structural checks for the Copernicus skills-only plugin."""

from __future__ import annotations

import json
from pathlib import Path
import re
import unittest


ROOT = Path(__file__).resolve().parent
COMPANIONS = ("grill-me", "ponytail", "caveman", "handoff")


class PluginTest(unittest.TestCase):
    def test_manifest_keeps_supported_prompt_limit(self) -> None:
        manifest = json.loads((ROOT / ".codex-plugin/plugin.json").read_text())
        self.assertEqual(manifest["skills"], "./skills/")
        self.assertLessEqual(len(manifest["interface"]["defaultPrompt"]), 3)
        self.assertEqual(len(list((ROOT / "skills").glob("*/SKILL.md"))), 12)

    def test_companions_are_self_contained_opt_in_fallbacks(self) -> None:
        for name in COMPANIONS:
            skill = (ROOT / "skills" / name / "SKILL.md").read_text()
            metadata = (ROOT / "skills" / name / "agents/openai.yaml").read_text()
            declared = re.search(r"(?m)^name: ([a-z0-9-]+)$", skill)
            self.assertIsNotNone(declared, name)
            self.assertEqual(declared.group(1), name)
            self.assertIn("non-Copernicus", skill)
            self.assertIn("Do not probe skill\ndirectories or install anything", skill)
            self.assertIn("allow_implicit_invocation: false", metadata)

    def test_companion_safety_contracts_stay_load_bearing(self) -> None:
        grill = (ROOT / "skills/grill-me/SKILL.md").read_text()
        ponytail = (ROOT / "skills/ponytail/SKILL.md").read_text()
        caveman = (ROOT / "skills/caveman/SKILL.md").read_text()
        handoff = (ROOT / "skills/handoff/SKILL.md").read_text()
        self.assertIn("Ask exactly one question per turn", grill)
        self.assertIn("Give a recommended answer", grill)
        self.assertIn("separately authorizes that action", grill)
        self.assertIn("Does this need to exist", ponytail)
        self.assertIn("Bug fix = root cause", ponytail)
        self.assertIn("Never simplify away", ponytail)
        self.assertIn("one runnable check", ponytail)
        self.assertIn("Default to **full**", ponytail)
        self.assertIn("Preserve code, commands, paths, identifiers, error messages", caveman)
        self.assertIn("complete, ordinary prose for security warnings", caveman)
        self.assertIn("operating system's temporary directory", handoff)
        self.assertIn("Perform a final redaction pass", handoff)

    def test_retrospective_stays_evidence_first_and_proposal_only(self) -> None:
        skill = (ROOT / "skills/retrospective/SKILL.md").read_text()
        metadata = (ROOT / "skills/retrospective/agents/openai.yaml").read_text()
        self.assertIn("Evidence before interpretation", skill)
        self.assertIn("first observable divergence", skill)
        self.assertIn("Never invent hidden reasoning", skill)
        self.assertIn("proposal-only", skill)
        self.assertIn("native scheduling", skill)
        self.assertIn("Coverage", skill)
        self.assertIn("allow_implicit_invocation: true", metadata)

    def test_breathe_checkpoint_and_fleet_preset_contracts_stay_load_bearing(self) -> None:
        breathe = (ROOT / "skills/breathe/SKILL.md").read_text()
        fleet = (ROOT / "skills/fleet/SKILL.md").read_text()
        self.assertTrue((ROOT / "skills/fleet/fleet.yaml").is_file())
        self.assertIn("Checkpoint", breathe)
        self.assertIn("no decision required", breathe)
        self.assertIn("Only the lead invokes Breathe", breathe)
        self.assertIn("Emit every heading", breathe)
        self.assertIn("all seven exact", breathe)
        self.assertIn("do not silently turn it into a decision", breathe)
        self.assertIn("complete checkpoint brief", breathe)
        self.assertIn("execution-heavy work", breathe)
        self.assertIn("do not append them to a normal response", breathe)
        self.assertIn("terra-first", fleet)
        self.assertIn("luna-breadth", fleet)
        self.assertIn("omit the roster", fleet)
        self.assertNotIn("Finish with a roster", fleet)
        self.assertNotIn("Put the compact Fleet roster", breathe)

    def test_planning_stays_durable_test_first_and_dependency_checked(self) -> None:
        skill = (ROOT / "skills/planning/SKILL.md").read_text()
        guide = (ROOT / "skills/planning/references/guide.md").read_text()
        script = (ROOT / "skills/planning/scripts/workpacks.py").read_text()
        metadata = (ROOT / "skills/planning/agents/openai.yaml").read_text()
        for mode in ("native", "workpacks", "discovery", "review"):
            self.assertIn(f"`{mode}`", skill)
        self.assertIn("tests written before implementation", skill)
        self.assertIn("A plan is not progress, evidence, or permission", skill)
        self.assertIn("parent", guide)
        self.assertIn("depends_on", guide)
        self.assertIn("TopologicalSorter", script)
        self.assertIn("implementation-ready", script)
        self.assertIn("$planning", metadata)

    def test_okf_docs_is_v02_traversal_first_and_self_contained(self) -> None:
        skill = (ROOT / "skills/okf-docs/SKILL.md").read_text()
        guide = (ROOT / "skills/okf-docs/references/guide.md").read_text()
        spec = (ROOT / "skills/okf-docs/references/okf-v0.2.md").read_text()
        script = (ROOT / "skills/okf-docs/scripts/okf.py").read_text()
        metadata = (ROOT / "skills/okf-docs/agents/openai.yaml").read_text()
        vendor = ROOT / "skills/okf-docs/scripts/_vendor"
        for command in (
            "scan",
            "validate",
            "query",
            "neighbors",
            "path",
            "impact",
            "context",
            "health",
            "index",
            "migrate",
        ):
            self.assertIn(f"`{command}`", skill)
        self.assertIn("OKF v0.2", skill)
        self.assertIn("progressive disclosure", guide)
        self.assertIn("Version 0.2", spec)
        self.assertIn("StrictSafeLoader", script)
        self.assertIn("MARKER_START", script)
        self.assertTrue((vendor / "yaml/__init__.py").is_file())
        self.assertTrue((vendor / "PyYAML-LICENSE.txt").is_file())
        self.assertTrue((ROOT / "skills/okf-docs/references/Apache-2.0.txt").is_file())
        self.assertIn("$okf-docs", metadata)

    def test_third_party_notices_ship_with_the_plugin(self) -> None:
        notices = (ROOT / "THIRD_PARTY_NOTICES.md").read_text()
        self.assertIn("mattpocock/skills", notices)
        self.assertIn("DietrichGebert/ponytail", notices)
        self.assertIn("GoogleCloudPlatform/knowledge-catalog", notices)
        self.assertIn("PyYAML 6.0.3", notices)
        self.assertIn("Copyright (c) 2026 Matt Pocock", notices)
        self.assertIn("Copyright (c) 2026 DietrichGebert", notices)
        self.assertEqual(notices.count("MIT License"), 2)


if __name__ == "__main__":
    unittest.main()
