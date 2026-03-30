from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from scripts.bump_version import bump_version, parse_version, read_version_from_file, update_version_file


class BumpVersionTests(unittest.TestCase):
    def test_parse_version_accepts_valid_semver(self) -> None:
        self.assertEqual(parse_version("1.2.3"), (1, 2, 3))

    def test_parse_version_rejects_invalid_semver(self) -> None:
        with self.assertRaises(ValueError):
            parse_version("1.2")

    def test_bump_version_for_fix(self) -> None:
        self.assertEqual(bump_version("1.2.3", "fix"), "1.2.4")

    def test_bump_version_for_feat(self) -> None:
        self.assertEqual(bump_version("1.2.3", "feat"), "1.3.0")

    def test_bump_version_for_breaking(self) -> None:
        self.assertEqual(bump_version("1.2.3", "breaking"), "2.0.0")

    def test_update_version_file_updates_single_definition(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            file_path = Path(tmp_dir) / "version.py"
            file_path.write_text('VERSION = "0.1.0"\n', encoding="utf-8")

            update_version_file(file_path, "0.2.0")
            self.assertEqual(read_version_from_file(file_path), "0.2.0")

    def test_update_version_file_fails_on_duplicate_definition(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            file_path = Path(tmp_dir) / "version.py"
            file_path.write_text('VERSION = "0.1.0"\nVERSION = "0.2.0"\n', encoding="utf-8")

            with self.assertRaises(ValueError):
                update_version_file(file_path, "0.3.0")


if __name__ == "__main__":
    unittest.main()
