#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is required. Use a throwaway synthetic Postgres database only." >&2
  exit 1
fi

API_PORT="${API_PORT:-3031}"
API_BASE_URL="http://localhost:${API_PORT}/api/v1"
API_LOG="${TMPDIR:-/tmp}/eyther-prisma-auth-api-${API_PORT}.log"
AUTH_COOKIE_JAR="${TMPDIR:-/tmp}/eyther-prisma-auth-${API_PORT}.cookies"
HEADERS_FILE="${TMPDIR:-/tmp}/eyther-prisma-auth-${API_PORT}.headers"

api_pid=""

cleanup() {
  if [[ -n "$api_pid" ]]; then kill "$api_pid" 2>/dev/null || true; fi
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
    echo "Port ${port} is already in use. Set API_PORT to a free port and rerun." >&2
    exit 1
  fi
}

expect_status() {
  local expected="$1"
  local method="$2"
  local url="$3"
  shift 3
  local code
  code="$(curl -sS -o /tmp/eyther-prisma-auth-response.json -w "%{http_code}" -X "$method" "$url" "$@")"
  if [[ "$code" != "$expected" ]]; then
    echo "Expected ${expected} from ${method} ${url}, got ${code}" >&2
    cat /tmp/eyther-prisma-auth-response.json >&2 || true
    exit 1
  fi
}

require_free_port "$API_PORT"

run pnpm --filter @eyther/db prisma:generate
run pnpm --filter @eyther/db prisma:migrate:deploy
run pnpm --filter @eyther/db auth:seed:synthetic
run pnpm build:api

echo
echo "==> Starting Prisma-backed API on ${API_BASE_URL}"
PORT="$API_PORT" EYTHER_AUTH_STORE=prisma DATABASE_URL="$DATABASE_URL" pnpm start:api >"$API_LOG" 2>&1 &
api_pid=$!

for attempt in {1..60}; do
  if curl -fsS "${API_BASE_URL}/health" >/dev/null 2>&1; then
    break
  fi
  sleep 1
  if [[ "$attempt" -eq 60 ]]; then
    echo "Prisma-backed API did not become ready." >&2
    cat "$API_LOG" >&2 || true
    exit 1
  fi
done

echo
echo "==> Probing DB-backed auth"
expect_status 401 GET "${API_BASE_URL}/worklist"
expect_status 401 POST "${API_BASE_URL}/auth/login/start" -H "Content-Type: application/json" -d '{"email":"unknown@example.test"}'

login_start="$(curl -fsS -X POST "${API_BASE_URL}/auth/login/start" -H "Content-Type: application/json" -d '{"email":"insurance.desk@example.test"}')"
challenge_id="$(printf '%s' "$login_start" | node -e "let body=''; process.stdin.on('data', c => body += c); process.stdin.on('end', () => process.stdout.write(JSON.parse(body).data.login_challenge_id));")"

expect_status 401 POST "${API_BASE_URL}/auth/login/verify" -H "Content-Type: application/json" -d "{\"login_challenge_id\":\"${challenge_id}\",\"otp\":\"111111\"}"

rm -f "$AUTH_COOKIE_JAR" "$HEADERS_FILE"
curl -fsS -D "$HEADERS_FILE" -c "$AUTH_COOKIE_JAR" -X POST "${API_BASE_URL}/auth/login/verify" \
  -H "Content-Type: application/json" \
  -d "{\"login_challenge_id\":\"${challenge_id}\",\"otp\":\"000000\"}" >/dev/null

grep -qi "Set-Cookie: eyther_session=" "$HEADERS_FILE"
grep -qi "HttpOnly" "$HEADERS_FILE"
grep -qi "SameSite=Lax" "$HEADERS_FILE"
grep -qi "Path=/" "$HEADERS_FILE"
grep -qi "Max-Age=28800" "$HEADERS_FILE"

curl -fsS -b "$AUTH_COOKIE_JAR" "${API_BASE_URL}/worklist" >/dev/null
curl -sS -b "$AUTH_COOKIE_JAR" -X POST "${API_BASE_URL}/claims/CLM-TEST-0001/packets/PACKET-TEST-0001/send" \
  | node -e "let body=''; process.stdin.on('data', c => body += c); process.stdin.on('end', () => { const parsed = JSON.parse(body); if (parsed.code !== 'ACTIVE_SEND_BLOCKED') { console.error(body); process.exit(1); } });"

curl -fsS -D "$HEADERS_FILE" -b "$AUTH_COOKIE_JAR" -X POST "${API_BASE_URL}/auth/logout" >/dev/null
grep -qi "Max-Age=0" "$HEADERS_FILE"
expect_status 401 GET "${API_BASE_URL}/worklist" -b "$AUTH_COOKIE_JAR"

run pnpm --filter @eyther/db auth:assert:synthetic

echo
echo "Prisma-backed synthetic auth verification passed."
