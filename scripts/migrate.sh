#!/usr/bin/env bash
set -euo pipefail
p="$(cd "$(dirname "$0")/.."&&pwd)";set -a;. "$p/.env";set +a;(cd "$p/backend"&&npm run migrate)
