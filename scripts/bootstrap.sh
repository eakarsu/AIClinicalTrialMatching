#!/usr/bin/env bash
set -euo pipefail
p="$(cd "$(dirname "$0")/.."&&pwd)";[ -f "$p/.env" ]||cp "$p/.env.example" "$p/.env";(cd "$p/backend"&&npm ci);(cd "$p/frontend"&&npm ci)
