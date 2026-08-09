#!/usr/bin/env python3
"""Small deterministic checks for the practitioner report generator."""

from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from report import main, validate_html_document


class ReportScriptTests(unittest.TestCase):
    def test_generates_and_checks_complete_lesson(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            input_path = root / "lesson.json"
            output_path = root / "lesson.html"
            input_path.write_text(json.dumps({
                "title": "A tiny feedback loop",
                "mode": "lesson",
                "summary": "A measured loop improves one assumption at a time.",
                "audience": "Practitioners",
                "scope": "One experiment",
                "sections": [{"heading": "Mechanism", "body": "Measure before changing the next hypothesis.", "items": ["Observe", "Change", "Measure again"]}],
                "facts": ["The evaluator runs after each candidate."],
                "inferences": ["Smaller changes make outcomes easier to interpret."],
                "unknowns": ["The next failure mode is not known yet."],
                "recommendation": {"text": "Change one hypothesis at a time.", "falsifier": "A one-change run with ambiguous evidence would disprove the recommendation."},
                "sources": [{"label": "Public example", "url": "https://example.com/evidence"}],
                "diagram": {"title": "Feedback flow", "description": "Observe, change, then measure.", "steps": ["Observe", "Change", "Measure"], "sidecar": "feedback.excalidraw"},
                "quiz": {"question": "What should change between two measurements?", "choices": ["One hypothesis", "Every variable"], "answer": "One hypothesis", "explanation": "A narrow change makes the result interpretable."}
            }), encoding="utf-8")
            self.assertEqual(main(["generate", str(input_path), str(output_path)]), 0)
            document = output_path.read_text(encoding="utf-8")
            self.assertIn("<details>", document)
            self.assertIn("feedback.excalidraw", document)
            self.assertIn("<svg", document)
            self.assertEqual(main(["check", str(output_path)]), 0)

    def test_rejects_private_path_before_writing(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            input_path = root / "unsafe.json"
            output_path = root / "unsafe.html"
            input_path.write_text(json.dumps({
                "title": "Unsafe example",
                "mode": "brief",
                "summary": "Saved at " + "/" + "home" + "/example/private/report.txt",
                "sections": [{"heading": "State", "body": "Do not publish this."}]
            }), encoding="utf-8")
            self.assertEqual(main(["generate", str(input_path), str(output_path)]), 1)
            self.assertFalse(output_path.exists())

    def test_checker_rejects_runtime_code_and_broken_anchor(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            report = Path(temporary) / "unsafe.html"
            report.write_text("""<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width\"><meta http-equiv=\"refresh\" content=\"0;url=https://example.com\"><title>Unsafe</title><style>body{background:url(https://example.com/a)}</style></head><body><main><h1>Unsafe</h1><a href=\"#missing\">broken</a><img srcset=\"https://example.com/a.png\"><script>bad()</script></main></body></html>""", encoding="utf-8")
            self.assertEqual(main(["check", str(report)]), 1)

    def test_checker_rejects_duplicate_attributes_and_ping(self) -> None:
        document = """<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width\"><meta http-equiv=\"content-type\" http-equiv=\"refresh\" content=\"0\"><title>Unsafe</title><style>body{}</style></head><body><main><h1>Unsafe</h1><a href=\"https://example.com\" href=\"javascript:bad()\" ping=\"https://example.com/ping\">unsafe</a></main></body></html>"""
        errors = validate_html_document(document)
        self.assertIn("meta refresh is not allowed", errors)
        self.assertIn("unsafe link target: javascript:bad()", errors)
        self.assertIn("link ping is not allowed", errors)

    def test_checker_rejects_responsive_and_escaped_assets(self) -> None:
        document = r'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Unsafe</title><style>body{background:u\72l(https://example.com/a.png);content:image-set("https://example.com/b.png" 1x)}</style></head><body><main id="report"><h1>Unsafe</h1><link rel="preload" as="image" href="#report" imagesrcset="https://example.com/a.png 1x"></main></body></html>'''
        errors = validate_html_document(document)
        self.assertIn("remote or embedded CSS asset found", errors)
        self.assertIn("embedded or remote `src` assets are not allowed", errors)

    def test_enforces_mode_and_sidecar_contracts(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            base = {
                "title": "Contract check",
                "summary": "A concise contract check.",
                "sections": [{"heading": "State", "body": "One bounded section."}],
            }
            decision = dict(base, mode="decision")
            decision_path = root / "decision.json"
            decision_path.write_text(json.dumps(decision), encoding="utf-8")
            self.assertEqual(main(["generate", str(decision_path), str(root / "decision.html")]), 1)

            quiz = dict(base, mode="brief", quiz={"question": "Which?", "choices": ["A", "B"], "answer": "A"})
            quiz_path = root / "quiz.json"
            quiz_path.write_text(json.dumps(quiz), encoding="utf-8")
            self.assertEqual(main(["generate", str(quiz_path), str(root / "quiz.html")]), 1)

            sidecar = dict(base, mode="brief", diagram={"title": "Flow", "description": "A short flow.", "steps": ["One", "Two"], "sidecar": "%2e%2e/private.excalidraw"})
            sidecar_path = root / "sidecar.json"
            sidecar_path.write_text(json.dumps(sidecar), encoding="utf-8")
            self.assertEqual(main(["generate", str(sidecar_path), str(root / "sidecar.html")]), 1)

            whitespace_sidecar = dict(base, mode="brief", diagram={"title": "Flow", "description": "A short flow.", "steps": ["One", "Two"], "sidecar": "\t//example.com/private.excalidraw"})
            whitespace_path = root / "whitespace-sidecar.json"
            whitespace_path.write_text(json.dumps(whitespace_sidecar), encoding="utf-8")
            self.assertEqual(main(["generate", str(whitespace_path), str(root / "whitespace-sidecar.html")]), 1)


if __name__ == "__main__":
    unittest.main()
