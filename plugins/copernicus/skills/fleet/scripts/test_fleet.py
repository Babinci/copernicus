import importlib.util
import json
from pathlib import Path
import tempfile
import unittest


MODULE_PATH = Path(__file__).with_name("fleet.py")
SPEC = importlib.util.spec_from_file_location("copernicus_fleet", MODULE_PATH)
fleet = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(fleet)


class FleetTest(unittest.TestCase):
    def test_default_yaml_preset_is_terra_first(self):
        config = fleet.load_config()
        self.assertEqual(config["preset"], "terra-first")
        self.assertEqual(config["default_lane"], "terra")
        self.assertEqual(config["models"]["terra"]["model"], "gpt-5.6-terra")

    def test_named_preset_restores_luna_breadth(self):
        config = fleet.load_config(preset="luna-breadth")
        self.assertEqual(config["preset"], "luna-breadth")
        self.assertEqual(config["default_lane"], "luna")

    def test_models_fail_closed_on_non_gpt_model(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "models.json"
            path.write_text(
                json.dumps(
                    {
                        "other": {
                            "model": "third-party-model",
                            "effort": "high",
                            "max_concurrency": 1,
                            "timeout_seconds": 30,
                        }
                    }
                )
            )
            with self.assertRaisesRegex(fleet.FleetError, "not GPT-only"):
                fleet.load_models(path)

    def test_legacy_json_model_map_remains_explicit_lane_only(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "models.json"
            path.write_text(
                json.dumps(
                    {
                        "terra": {
                            "model": "gpt-5.6-terra",
                            "effort": "medium",
                            "max_concurrency": 1,
                            "timeout_seconds": 30,
                        }
                    }
                )
            )
            config = fleet.load_config(path)
            self.assertIsNone(config["preset"])
            self.assertIsNone(config["default_lane"])
            self.assertEqual(set(config["models"]), {"terra"})

    def test_manifest_uses_preset_default_without_overriding_explicit_lane(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "prompt.md").write_text("work")
            manifest = root / "manifest.jsonl"
            manifest.write_text(
                json.dumps({"id": "default", "prompt": "prompt.md"})
                + "\n"
                + json.dumps({"id": "explicit", "lane": "luna", "prompt": "prompt.md"})
                + "\n"
            )
            config = fleet.load_config()
            seats = fleet.load_manifest(
                manifest,
                config["models"],
                root,
                default_lane=config["default_lane"],
            )
            self.assertEqual([seat["lane"] for seat in seats], ["terra", "luna"])

    def test_manifest_rejects_duplicate_ids(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "prompt.md").write_text("work")
            manifest = root / "manifest.jsonl"
            row = {"id": "same", "lane": "luna", "prompt": "prompt.md"}
            manifest.write_text(json.dumps(row) + "\n" + json.dumps(row) + "\n")
            with self.assertRaisesRegex(fleet.FleetError, "duplicate seat"):
                fleet.load_manifest(manifest, fleet.load_models())

    def test_manifest_rejects_prompt_symlink_escape(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            workdir = root / "work"
            workdir.mkdir()
            outside = root / "secret.md"
            outside.write_text("secret")
            (workdir / "prompt.md").symlink_to(outside)
            manifest = workdir / "manifest.jsonl"
            manifest.write_text(json.dumps({"id": "one", "lane": "sol", "prompt": "prompt.md"}) + "\n")
            with self.assertRaisesRegex(fleet.FleetError, "escapes workdir"):
                fleet.load_manifest(manifest, fleet.load_models(), workdir)

    def test_batch_writes_private_answers_and_roster(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            prompt = root / "prompt.md"
            prompt.write_text("bounded prompt")
            manifest = root / "manifest.jsonl"
            manifest.write_text(
                "\n".join(
                    json.dumps({"id": seat, "lane": "luna", "prompt": "prompt.md"})
                    for seat in ("one", "two")
                )
                + "\n"
            )
            fake = root / "fake-codex"
            fake.write_text(
                "#!/usr/bin/env python3\n"
                "import json,pathlib,sys\n"
                "args=sys.argv[1:]\n"
                "out=pathlib.Path(args[args.index('--output-last-message')+1])\n"
                "prompt=sys.stdin.read()\n"
                "out.write_text('answer: '+prompt)\n"
                "print(json.dumps({'type':'turn.completed'}))\n"
            )
            fake.chmod(0o755)
            run_dir = root / "run"
            exit_code = fleet.main(
                [
                    "batch",
                    str(manifest),
                    "--run-dir",
                    str(run_dir),
                    "--workdir",
                    str(root),
                    "--codex-bin",
                    str(fake),
                ]
            )
            self.assertEqual(exit_code, 0)
            roster = json.loads((run_dir / "roster.json").read_text())
            self.assertEqual([row["status"] for row in roster], ["ok", "ok"])
            self.assertEqual((run_dir / "one" / "answer.md").read_text(), "answer: bounded prompt")
            self.assertEqual((run_dir / "one" / "answer.md").stat().st_mode & 0o777, 0o600)

    def test_batch_records_launch_error(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "prompt.md").write_text("bounded prompt")
            manifest = root / "manifest.jsonl"
            manifest.write_text(json.dumps({"id": "one", "lane": "terra", "prompt": "prompt.md"}) + "\n")
            not_executable = root / "codex"
            not_executable.write_text("not executable")
            run_dir = root / "run"
            exit_code = fleet.main(
                [
                    "batch",
                    str(manifest),
                    "--run-dir",
                    str(run_dir),
                    "--workdir",
                    str(root),
                    "--codex-bin",
                    str(not_executable),
                ]
            )
            self.assertEqual(exit_code, 3)
            roster = json.loads((run_dir / "roster.json").read_text())
            self.assertEqual(roster[0]["status"], "launch-error")


if __name__ == "__main__":
    unittest.main()
