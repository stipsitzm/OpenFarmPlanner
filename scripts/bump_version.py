#!/usr/bin/env python3
"""Bump semantic version in backend/version.py."""

from __future__ import annotations

import argparse
from pathlib import Path
import re

VERSION_FILE = Path(__file__).resolve().parents[1] / 'backend' / 'version.py'
SEMVER_PATTERN = re.compile(r'^(?P<major>\d+)\.(?P<minor>\d+)\.(?P<patch>\d+)$')
ASSIGNMENT_PATTERN = re.compile(r'^(?P<prefix>\s*VERSION\s*=\s*")(?P<version>\d+\.\d+\.\d+)(?P<suffix>"\s*)$')


def parse_version(version: str) -> tuple[int, int, int]:
    match = SEMVER_PATTERN.fullmatch(version)
    if not match:
        raise ValueError(f'Invalid semantic version: {version}')
    return int(match.group('major')), int(match.group('minor')), int(match.group('patch'))


def bump(version: str, level: str) -> str:
    major, minor, patch = parse_version(version)
    if level == 'major':
        major += 1
        minor = 0
        patch = 0
    elif level == 'minor':
        minor += 1
        patch = 0
    else:
        patch += 1
    return f'{major}.{minor}.{patch}'


def read_current_version(lines: list[str]) -> tuple[int, str]:
    for index, line in enumerate(lines):
        match = ASSIGNMENT_PATTERN.match(line)
        if match:
            return index, match.group('version')
    raise RuntimeError(f'Could not find VERSION assignment in {VERSION_FILE}')


def write_bumped_version(level: str) -> str:
    lines = VERSION_FILE.read_text(encoding='utf-8').splitlines()
    index, current_version = read_current_version(lines)
    next_version = bump(current_version, level)

    match = ASSIGNMENT_PATTERN.match(lines[index])
    if match is None:
        raise RuntimeError('VERSION assignment line has an unexpected format.')

    lines[index] = f"{match.group('prefix')}{next_version}{match.group('suffix')}"
    VERSION_FILE.write_text('\n'.join(lines) + '\n', encoding='utf-8')
    return next_version


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description='Bump OpenFarmPlanner semantic version.')
    parser.add_argument('level', choices=('patch', 'minor', 'major'), help='Version segment to bump.')
    parser.add_argument('--tag', action='store_true', help='Print suggested tag command for the new version.')
    return parser


if __name__ == '__main__':
    args = build_parser().parse_args()
    bumped_version = write_bumped_version(args.level)
    print(bumped_version)
    if args.tag:
        print(f'git tag v{bumped_version}')
