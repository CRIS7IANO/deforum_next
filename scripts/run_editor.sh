#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/../web_editor"
npm install
npm run dev
