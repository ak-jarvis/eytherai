#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is required. Use a throwaway synthetic Postgres database only." >&2
  exit 1
fi

API_PORT="${API_PORT:-3042}"
API_BASE_URL="http://localhost:${API_PORT}/api/v1"
API_LOG="${TMPDIR:-/tmp}/eyther-prisma-phase1-api-${API_PORT}.log"
AUTH_COOKIE_JAR="${TMPDIR:-/tmp}/eyther-prisma-phase1-${API_PORT}.cookies"
HEADERS_FILE="${TMPDIR:-/tmp}/eyther-prisma-phase1-${API_PORT}.headers"
RESPONSE_FILE="${TMPDIR:-/tmp}/eyther-prisma-phase1-${API_PORT}.response.json"

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

start_api() {
  echo
  echo "==> Starting Prisma-backed Phase 1 API on ${API_BASE_URL}"
  PORT="$API_PORT" EYTHER_AUTH_STORE=prisma EYTHER_PHASE1_STORE=prisma DATABASE_URL="$DATABASE_URL" pnpm start:api >"$API_LOG" 2>&1 &
  api_pid=$!

  for attempt in {1..60}; do
    if curl -fsS "${API_BASE_URL}/health" >/dev/null 2>&1; then
      return
    fi
    sleep 1
    if [[ "$attempt" -eq 60 ]]; then
      echo "Prisma-backed Phase 1 API did not become ready." >&2
      cat "$API_LOG" >&2 || true
      exit 1
    fi
  done
}

stop_api() {
  if [[ -n "$api_pid" ]]; then
    kill "$api_pid" 2>/dev/null || true
    wait "$api_pid" 2>/dev/null || true
    api_pid=""
  fi
}

expect_status() {
  local expected="$1"
  local method="$2"
  local url="$3"
  shift 3
  local code
  code="$(curl -sS -o "$RESPONSE_FILE" -w "%{http_code}" -X "$method" "$url" "$@")"
  if [[ "$code" != "$expected" ]]; then
    echo "Expected ${expected} from ${method} ${url}, got ${code}" >&2
    cat "$RESPONSE_FILE" >&2 || true
    exit 1
  fi
}

json_field() {
  local field="$1"
  node -e "let body=''; process.stdin.on('data', c => body += c); process.stdin.on('end', () => process.stdout.write(String(JSON.parse(body).data.${field})));"
}

require_free_port "$API_PORT"

run pnpm --filter @eyther/db prisma:generate
run pnpm --filter @eyther/db prisma:migrate:deploy
run pnpm --filter @eyther/db auth:seed:synthetic
run pnpm --filter @eyther/db phase1:seed:synthetic
run pnpm build:api

start_api

echo
echo "==> Logging in with Prisma auth"
rm -f "$AUTH_COOKIE_JAR" "$HEADERS_FILE"
login_start="$(curl -fsS -X POST "${API_BASE_URL}/auth/login/start" -H "Content-Type: application/json" -d '{"email":"insurance.desk@example.test"}')"
challenge_id="$(printf '%s' "$login_start" | json_field "login_challenge_id")"
curl -fsS -D "$HEADERS_FILE" -c "$AUTH_COOKIE_JAR" -X POST "${API_BASE_URL}/auth/login/verify" \
  -H "Content-Type: application/json" \
  -d "{\"login_challenge_id\":\"${challenge_id}\",\"otp\":\"000000\"}" >/dev/null
grep -qi "Set-Cookie: eyther_session=" "$HEADERS_FILE"
grep -qi "HttpOnly" "$HEADERS_FILE"

echo
echo "==> Probing persisted onboarding and setup evidence"
curl -fsS -b "$AUTH_COOKIE_JAR" "${API_BASE_URL}/setup/onboarding-state" \
  | node -e "let body=''; process.stdin.on('data', c => body += c); process.stdin.on('end', () => { const data = JSON.parse(body).data; if (!data.ready_for_claim_desk || !data.blocked_reason_codes.includes('missing_test_email_acknowledgement')) { console.error(body); process.exit(1); } });"

artifact_response="$(curl -fsS -b "$AUTH_COOKIE_JAR" -X POST "${API_BASE_URL}/setup/evidence-artifacts" \
  -H "Content-Type: application/json" \
  -d '{"artifact_type":"payer_mix_csv","source_label_sanitized":"synthetic prisma verifier payer mix","headers":["counterparty_display_name","claim_count","claim_value_processed"]}')"
artifact_id="$(printf '%s' "$artifact_response" | json_field "artifact_id")"

curl -fsS -b "$AUTH_COOKIE_JAR" -X POST "${API_BASE_URL}/setup/evidence-artifacts" \
  -H "Content-Type: application/json" \
  -d '{"artifact_type":"payer_mix_csv","source_label_sanitized":"bad synthetic header verifier","headers":["Patient Name","counterparty_display_name"]}' \
  | node -e "let body=''; process.stdin.on('data', c => body += c); process.stdin.on('end', () => { const data = JSON.parse(body).data; if (data.pii_scan_status !== 'rejected') { console.error(body); process.exit(1); } });"

curl -fsS -b "$AUTH_COOKIE_JAR" -X POST "${API_BASE_URL}/setup/payer-mix/import" \
  -H "Content-Type: application/json" \
  -d "{\"source_artifact_id\":\"${artifact_id}\",\"rows\":[{\"counterparty_display_name\":\"Example TPA Sandbox\",\"counterparty_type\":\"tpa\",\"claim_count\":12,\"claim_value_processed\":100000}]}" \
  | node -e "let body=''; process.stdin.on('data', c => body += c); process.stdin.on('end', () => { const data = JSON.parse(body).data; if (data.accepted_rows !== 1 || data.rejected_rows !== 0) { console.error(body); process.exit(1); } });"

echo
echo "==> Probing persisted claim, packet, document, lifecycle, match, and export"
CLAIM_ID="CLM-TEST-PERSIST-0001"
PACKET_ID="PACKET-TEST-PERSIST-0001"
DOCUMENT_ID="DOC-TEST-PERSIST-0001"
EXPORT_ID="EXPORT-TEST-PERSIST-0001"

curl -fsS -b "$AUTH_COOKIE_JAR" -X POST "${API_BASE_URL}/claims" \
  -H "Content-Type: application/json" \
  -d "{\"claim_id\":\"${CLAIM_ID}\",\"patient_ref_masked\":\"PT-MASKED-0099\",\"policy_ref_masked\":\"POLICY-MASKED-0099\",\"counterparty_display_name\":\"Example TPA Sandbox\",\"preauth_requested_amount\":94000}" >/dev/null

curl -fsS -b "$AUTH_COOKIE_JAR" -X POST "${API_BASE_URL}/claims/${CLAIM_ID}/packets" \
  -H "Content-Type: application/json" \
  -d "{\"packet_id\":\"${PACKET_ID}\",\"packet_type\":\"enhancement\",\"requested_amount\":12000,\"trigger_reason\":\"longer_stay\"}" >/dev/null

curl -fsS -b "$AUTH_COOKIE_JAR" -X POST "${API_BASE_URL}/claims/${CLAIM_ID}/packets/${PACKET_ID}/documents" \
  -H "Content-Type: application/json" \
  -d "{\"document_id\":\"${DOCUMENT_ID}\",\"document_type\":\"doctor_note\",\"file_name_sanitized\":\"synthetic-doctor-note.pdf\",\"source_label_sanitized\":\"synthetic prisma verifier upload\"}" >/dev/null

curl -fsS -b "$AUTH_COOKIE_JAR" -X POST "${API_BASE_URL}/claims/${CLAIM_ID}/lifecycle-events" \
  -H "Content-Type: application/json" \
  -d '{"to_stage":"query","to_status":"query_raised","reason_note_sanitized":"synthetic query received"}' >/dev/null

curl -fsS -b "$AUTH_COOKIE_JAR" -X POST "${API_BASE_URL}/email-events/EMAIL-TEST-0001/manual-match" \
  -H "Content-Type: application/json" \
  -d '{"claim_id":"CLM-TEST-0001"}' >/dev/null

curl -fsS -b "$AUTH_COOKIE_JAR" -X POST "${API_BASE_URL}/exports" \
  -H "Content-Type: application/json" \
  -d "{\"export_id\":\"${EXPORT_ID}\",\"export_type\":\"finance_settlement_csv\",\"reason_note_sanitized\":\"synthetic finance verifier\"}" >/dev/null
curl -fsS -b "$AUTH_COOKIE_JAR" "${API_BASE_URL}/exports/${EXPORT_ID}/download" >/dev/null

expect_status 400 POST "${API_BASE_URL}/documents/${DOCUMENT_ID}/reveal" \
  -b "$AUTH_COOKIE_JAR" -H "Content-Type: application/json" -d '{}'
curl -fsS -b "$AUTH_COOKIE_JAR" -X POST "${API_BASE_URL}/documents/${DOCUMENT_ID}/reveal" \
  -H "Content-Type: application/json" \
  -d '{"reason_note_sanitized":"synthetic reviewer reveal check"}' \
  | node -e "let body=''; process.stdin.on('data', c => body += c); process.stdin.on('end', () => { const data = JSON.parse(body).data; if (data.reveal_allowed !== false || data.status !== 'blocked') { console.error(body); process.exit(1); } });"

expect_status 423 POST "${API_BASE_URL}/claims/CLM-TEST-0001/packets/PACKET-TEST-0001/send" -b "$AUTH_COOKIE_JAR"
RESPONSE_FILE="$RESPONSE_FILE" node -e "const body = require('fs').readFileSync(process.env.RESPONSE_FILE, 'utf8'); const parsed = JSON.parse(body); if (parsed.code !== 'ACTIVE_SEND_BLOCKED') { console.error(body); process.exit(1); }"

echo
echo "==> Restarting API to prove operational state survives process restart"
stop_api
start_api

curl -fsS -b "$AUTH_COOKIE_JAR" "${API_BASE_URL}/claims/${CLAIM_ID}" \
  | node -e "let body=''; process.stdin.on('data', c => body += c); process.stdin.on('end', () => { const data = JSON.parse(body).data; if (data.claim_id !== '${CLAIM_ID}' || data.current_stage !== 'query' || !data.timeline.some((event) => event.to_stage === 'query')) { console.error(body); process.exit(1); } });"

run pnpm --filter @eyther/db phase1:assert:synthetic

echo
echo "Prisma-backed synthetic Phase 1 operational verification passed."
