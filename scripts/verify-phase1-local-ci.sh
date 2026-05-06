#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

API_PORT="${API_PORT:-3021}"
WEB_PORT="${WEB_PORT:-3020}"
API_BASE_URL="http://localhost:${API_PORT}/api/v1"
WEB_BASE_URL="http://localhost:${WEB_PORT}"
API_LOG="${TMPDIR:-/tmp}/eyther-phase1-api-${API_PORT}.log"
WEB_LOG="${TMPDIR:-/tmp}/eyther-phase1-web-${WEB_PORT}.log"
AUTH_COOKIE_JAR="${TMPDIR:-/tmp}/eyther-phase1-auth-${API_PORT}.cookies"

api_pid=""
web_pid=""

cleanup() {
  if [[ -n "$api_pid" ]]; then kill "$api_pid" 2>/dev/null || true; fi
  if [[ -n "$web_pid" ]]; then kill "$web_pid" 2>/dev/null || true; fi
}
trap cleanup EXIT

run() {
  echo
  echo "==> $*"
  "$@"
}

require_free_port() {
  local port="$1"
  if lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "Port ${port} is already in use. Set API_PORT/WEB_PORT to free ports and rerun." >&2
    exit 1
  fi
}

require_free_port "$API_PORT"
require_free_port "$WEB_PORT"

run pnpm lint
run pnpm typecheck
run pnpm test
run env NEXT_PUBLIC_API_BASE_URL="$API_BASE_URL" pnpm build
run pnpm fixtures:scan
run pnpm pii:scan
run pnpm --filter @eyther/api test
run pnpm --filter @eyther/db prisma:validate
run node -e "for (const f of ['infra/railway/api.railway.json','infra/railway/worker.railway.json','vercel.json']) JSON.parse(require('fs').readFileSync(f,'utf8')); console.log('deployment config JSON valid')"

echo
echo "==> Starting built API on ${API_BASE_URL}"
PORT="$API_PORT" pnpm start:api >"$API_LOG" 2>&1 &
api_pid=$!

echo "==> Starting built web on ${WEB_BASE_URL}"
PORT="$WEB_PORT" NEXT_PUBLIC_API_BASE_URL="$API_BASE_URL" pnpm start:web >"$WEB_LOG" 2>&1 &
web_pid=$!

for attempt in {1..60}; do
  if curl -fsS "${API_BASE_URL}/health" >/dev/null 2>&1 && curl -fsS "${WEB_BASE_URL}/setup" >/dev/null 2>&1; then
    break
  fi
  sleep 1
  if [[ "$attempt" -eq 60 ]]; then
    echo "Local API/web did not become ready." >&2
    echo "--- API log ---" >&2
    cat "$API_LOG" >&2 || true
    echo "--- Web log ---" >&2
    cat "$WEB_LOG" >&2 || true
    exit 1
  fi
done

echo
echo "==> Probing Active Send backend guard"
rm -f "$AUTH_COOKIE_JAR"
curl -fsS -X POST "${API_BASE_URL}/auth/login/start" \
  -H "Content-Type: application/json" \
  -d '{"email":"insurance.desk@example.test"}' >/dev/null
curl -fsS -c "$AUTH_COOKIE_JAR" -X POST "${API_BASE_URL}/auth/login/verify" \
  -H "Content-Type: application/json" \
  -d '{"login_challenge_id":"LOGIN-TEST-0001","otp":"000000"}' >/dev/null
curl -sS -b "$AUTH_COOKIE_JAR" -X POST "${API_BASE_URL}/claims/CLM-TEST-0001/packets/PACKET-TEST-0001/send" \
  | node -e "let body=''; process.stdin.on('data', c => body += c); process.stdin.on('end', () => { const parsed = JSON.parse(body); if (parsed.code !== 'ACTIVE_SEND_BLOCKED') { console.error(body); process.exit(1); } console.log('Active Send guard blocked as expected'); });"

run env PLAYWRIGHT_BASE_URL="$WEB_BASE_URL" PLAYWRIGHT_API_URL="$API_BASE_URL" pnpm exec playwright test

echo
echo "Phase 1 local CI-equivalent verification passed."
