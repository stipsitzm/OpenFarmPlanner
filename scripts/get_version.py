#!/usr/bin/env python3
"""Print the current OpenFarmPlanner version."""

from pathlib import Path
import sys


BACKEND_DIR = Path(__file__).resolve().parents[1] / 'backend'


def read_version() -> str:
    """Read version from the backend central version module."""
    sys.path.insert(0, str(BACKEND_DIR))
    from config.version import get_version  # pylint: disable=import-outside-toplevel

    return get_version()


if __name__ == '__main__':
    print(read_version())
