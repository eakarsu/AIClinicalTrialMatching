#!/usr/bin/env bash
set -euo pipefail

p="$(cd "$(dirname "$0")" && pwd)"
[ -f "$p/.env" ] || { echo 'Copy .env.example to .env.' >&2; exit 1; }
[ -d "$p/backend/node_modules" ] && [ -d "$p/frontend/node_modules" ] || { echo 'Run scripts/bootstrap.sh first.' >&2; exit 1; }
set -a
. "$p/.env"
set +a

backend_port="${BACKEND_PORT:-4000}"
frontend_port="${FRONTEND_PORT:-3000}"
for port in "$backend_port" "$frontend_port"; do
  if lsof -tiTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "Port $port is already in use; refusing to stop another process." >&2
    exit 1
  fi
done

if [ "${MIGRATE_ON_START:-false}" = true ]; then
  case "${ALLOW_SCHEMA_MIGRATION:-}" in
    1|true) ;;
    *) echo 'Explicit schema migration acknowledgement is required.' >&2; exit 1 ;;
  esac
  bash "$p/scripts/migrate.sh"
  node "$p/backend/src/scripts/create-admin.js"
fi

(cd "$p/backend" && npm start) & b=$!
(cd "$p/frontend" && BROWSER=none PORT="$frontend_port" REACT_APP_API_BASE="http://127.0.0.1:$backend_port/api" ./node_modules/.bin/react-scripts start) & f=$!
cleanup() { kill "$b" "$f" 2>/dev/null || true; }
trap cleanup INT TERM EXIT
wait "$b" "$f"
