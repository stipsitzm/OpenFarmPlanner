#!/usr/bin/env python3
"""Print the current OpenFarmPlanner version."""

from pathlib import Path
import re

VERSION_FILE = Path(__file__).resolve().parents[1] / 'backend' / 'version.py'
VERSION_PATTERN = re.compile(r'^VERSION\s*=\s*"(?P<version>\d+\.\d+\.\d+)"\s*$')


def read_version() -> str:
    for line in VERSION_FILE.read_text(encoding='utf-8').splitlines():
        match = VERSION_PATTERN.match(line.strip())
        if match:
            return match.group('version')
    raise RuntimeError(f'Could not find VERSION in {VERSION_FILE}')


if __name__ == '__main__':
    print(read_version())
