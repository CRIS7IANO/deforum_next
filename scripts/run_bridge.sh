#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/../deforum_core"
if [ ! -d ".venv" ]; then
  python3 -m venv .venv
fi
source .venv/bin/activate
python -m pip install -U pip
pip install -e ".[dev]"
deforumx serve ../examples/project.defx --port 8787
