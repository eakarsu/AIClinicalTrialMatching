#!/usr/bin/env bash
set -euo pipefail
[ "${CONFIRM_DEMO_SEED:-}" = yes ]||{ echo 'Set CONFIRM_DEMO_SEED=yes; startup never seeds.' >&2;exit 1;};p="$(cd "$(dirname "$0")/.."&&pwd)";(cd "$p/backend"&&npm run seed)
