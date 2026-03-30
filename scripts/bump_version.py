#!/usr/bin/env python3
"""Semantic version bump utility for OpenFarmPlanner."""

from __future__ import annotations

import argparse
import re
import tempfile
from pathlib import Path

VERSION_PATTERN = re.compile(r'^(?P<major>0|[1-9]\d*)\.(?P<minor>0|[1-9]\d*)\.(?P<patch>0|[1-9]\d*)$')
VERSION_LINE_PATTERN = re.compile(r'^(?P<prefix>\s*VERSION\s*=\s*")(?P<version>[^"]+)(".*)$')
SUPPORTED_CHANGE_TYPES = {"feat", "fix", "breaking"}


def parse_version(value: str) -> tuple[int, int, int]:
    """Parse and validate a semantic version string."""
    match = VERSION_PATTERN.fullmatch(value.strip())
    if not match:
        raise ValueError(f"Invalid semantic version: {value!r}")
    return int(match.group("major")), int(match.group("minor")), int(match.group("patch"))


def bump_version(version: str, change_type: str) -> str:
    """Return bumped semantic version based on change type."""
    normalized_change = change_type.strip().lower()
    if normalized_change not in SUPPORTED_CHANGE_TYPES:
        raise ValueError(f"Unsupported change type: {change_type!r}")

    major, minor, patch = parse_version(version)

    if normalized_change == "breaking":
        major += 1
        minor = 0
        patch = 0
    elif normalized_change == "feat":
        minor += 1
        patch = 0
    else:  # fix
        patch += 1

    return f"{major}.{minor}.{patch}"


def read_version_from_file(version_file: Path) -> str:
    """Read and validate VERSION assignment from the version file."""
    content = version_file.read_text(encoding="utf-8")
    matches = list(VERSION_LINE_PATTERN.finditer(content))
    if not matches:
        raise ValueError(f"No VERSION definition found in {version_file}")
    if len(matches) > 1:
        raise ValueError(f"Multiple VERSION definitions found in {version_file}")
    return matches[0].group("version")


def update_version_file(version_file: Path, new_version: str) -> None:
    """Safely update VERSION assignment in the given file."""
    parse_version(new_version)
    content = version_file.read_text(encoding="utf-8")
    matches = list(VERSION_LINE_PATTERN.finditer(content))
    if not matches:
        raise ValueError(f"No VERSION definition found in {version_file}")
    if len(matches) > 1:
        raise ValueError(f"Multiple VERSION definitions found in {version_file}")

    old_line = matches[0].group(0)
    new_line = f'{matches[0].group("prefix")}{new_version}{matches[0].group(3)}'
    updated_content = content.replace(old_line, new_line, 1)

    if updated_content == content:
        return

    with tempfile.NamedTemporaryFile("w", delete=False, encoding="utf-8", dir=version_file.parent) as tmp_file:
        tmp_file.write(updated_content)
        temp_path = Path(tmp_file.name)
    temp_path.replace(version_file)


def build_parser() -> argparse.ArgumentParser:
    """Build CLI parser."""
    parser = argparse.ArgumentParser(
        description="Bump backend/config/version.py using semantic version rules.",
    )
    parser.add_argument(
        "--change-type",
        required=True,
        choices=sorted(SUPPORTED_CHANGE_TYPES),
        help="Type of change: feat (minor), fix (patch), breaking (major).",
    )
    parser.add_argument(
        "--file",
        default="backend/config/version.py",
        help="Path to version file (default: backend/config/version.py).",
    )
    return parser


def main() -> int:
    """Run CLI command."""
    args = build_parser().parse_args()
    version_file = Path(args.file)
    if not version_file.exists():
        raise FileNotFoundError(f"Version file does not exist: {version_file}")

    current_version = read_version_from_file(version_file)
    next_version = bump_version(current_version, args.change_type)
    update_version_file(version_file, next_version)
    print(f"Bumped version: {current_version} -> {next_version}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
