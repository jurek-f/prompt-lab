#!/usr/bin/env bash
set -e
cd "$(dirname "$0")/../.."
python3 -m venv .venv
source .venv/bin/activate
pip install -r environment/python/requirements.txt
echo ""
echo "venv ready. To activate: source .venv/bin/activate"
