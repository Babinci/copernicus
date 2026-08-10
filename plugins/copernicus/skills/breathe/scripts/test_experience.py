import json
import os
from pathlib import Path
import tempfile
import unittest

import experience


class ExperienceTest(unittest.TestCase):
    def test_private_feedback_becomes_bounded_hints(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "experience.jsonl"
            experience.record(path, "too-thin", "risks")
            experience.record(path, "expanded", "risks")
            experience.record(path, "useful", "recommendation")
            summary = experience.summarize(path)
            self.assertEqual(path.stat().st_mode & 0o777, 0o600)
            self.assertEqual(summary["sample_size"], 3)
            self.assertEqual(summary["hints"]["compression"], "fuller")
            self.assertEqual(summary["hints"]["emphasize"], ["risks"])
            rows = [json.loads(line) for line in path.read_text().splitlines()]
            self.assertEqual(set(rows[0]), {"version", "timestamp", "signal", "section"})

    def test_symlink_and_corrupt_rows_fail_closed(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            outside = root / "outside"
            outside.write_text("")
            link = root / "experience.jsonl"
            link.symlink_to(outside)
            with self.assertRaisesRegex(experience.ExperienceError, "symlink"):
                experience.record(link, "useful", "bottom-line")
            link.unlink()
            link.write_text('{"project":"must not be stored"}\n')
            with self.assertRaisesRegex(experience.ExperienceError, "row 1"):
                experience.summarize(link)
            link.write_bytes(b"\xff")
            with self.assertRaisesRegex(experience.ExperienceError, "UTF-8"):
                experience.summarize(link)

    def test_environment_override_is_exact(self):
        with tempfile.TemporaryDirectory() as directory:
            expected = Path(directory) / "chosen.jsonl"
            previous = os.environ.get("COPERNICUS_BREATHE_EXPERIENCE_FILE")
            os.environ["COPERNICUS_BREATHE_EXPERIENCE_FILE"] = str(expected)
            try:
                self.assertEqual(experience.experience_path(), expected)
            finally:
                if previous is None:
                    os.environ.pop("COPERNICUS_BREATHE_EXPERIENCE_FILE", None)
                else:
                    os.environ["COPERNICUS_BREATHE_EXPERIENCE_FILE"] = previous


if __name__ == "__main__":
    unittest.main()
