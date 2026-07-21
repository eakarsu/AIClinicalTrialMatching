#!/usr/bin/env bash
set -euo pipefail
p="$(cd "$(dirname "$0")"&&pwd)";[ -f "$p/.env" ]||{ echo 'Copy .env.example to .env.' >&2;exit 1;};[ -d "$p/backend/node_modules" ]&&[ -d "$p/frontend/node_modules" ]||{ echo 'Run scripts/bootstrap.sh first.' >&2;exit 1;};set -a;. "$p/.env";set +a
(cd "$p/backend"&&npm start)&b=$!;(cd "$p/frontend"&&BROWSER=none PORT="${FRONTEND_PORT:-3000}" npm start)&f=$!;cleanup(){ kill "$b" "$f" 2>/dev/null||true;};trap cleanup INT TERM EXIT;wait "$b" "$f"
