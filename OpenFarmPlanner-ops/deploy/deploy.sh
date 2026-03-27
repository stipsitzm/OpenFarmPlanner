#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
VERSION="$(python3 "$ROOT_DIR/scripts/get_version.py")"

echo "Deploying version: ${VERSION}"

if [[ "${TAG_RELEASE:-0}" == "1" ]]; then
  echo "Tagging release: v${VERSION}"
  git tag "v${VERSION}"
fi

# Add your deployment steps below.
