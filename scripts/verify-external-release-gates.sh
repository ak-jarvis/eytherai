#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

REPO="${GITHUB_REPO:-Rightful-labs/eyther-product}"
PR_NUMBER="${PR_NUMBER:-2}"
BRANCH="${BRANCH:-feat/t_855a76d0-gov-01-scaffold}"
RAILWAY_API_URL="${RAILWAY_API_URL:-}"
VERCEL_PREVIEW_URL="${VERCEL_PREVIEW_URL:-}"

failures=0

pass() {
  echo "PASS: $*"
}

block() {
  failures=$((failures + 1))
  echo "BLOCK: $*" >&2
}

note() {
  echo "NOTE: $*"
}

require_command() {
  local command_name="$1"
  if command -v "$command_name" >/dev/null 2>&1; then
    pass "${command_name} CLI available"
  else
    block "${command_name} CLI not available"
  fi
}

capture() {
  local output_file="$1"
  shift
  if "$@" >"$output_file" 2>&1; then
    return 0
  fi
  return 1
}

tmp_dir="${TMPDIR:-/tmp}/eyther-external-gates"
mkdir -p "$tmp_dir"

echo "Eyther Phase 1 external release gate verifier"
echo "Repo: ${REPO}"
echo "PR: ${PR_NUMBER}"
echo "Branch: ${BRANCH}"
echo
echo "This verifier never prints Railway variables or secrets."

echo
echo "==> CLI availability"
require_command gh
require_command railway
require_command vercel
require_command curl
require_command node

echo
echo "==> GitHub Actions and PR gates"
if capture "$tmp_dir/actions-permissions.json" gh api "repos/${REPO}/actions/permissions"; then
  if node -e "const fs=require('fs'); const parsed=JSON.parse(fs.readFileSync(process.argv[1], 'utf8')); process.exit(parsed.enabled === true ? 0 : 1);" "$tmp_dir/actions-permissions.json"; then
    pass "GitHub Actions enabled for ${REPO}"
  else
    block "GitHub Actions disabled for ${REPO}: $(cat "$tmp_dir/actions-permissions.json")"
  fi
else
  block "Could not read GitHub Actions permissions for ${REPO}: $(cat "$tmp_dir/actions-permissions.json" 2>/dev/null || true)"
fi

if capture "$tmp_dir/pr-view.json" gh pr view "$PR_NUMBER" --repo "$REPO" --json headRefName,headRefOid,state,isDraft,reviewDecision,statusCheckRollup,latestReviews,labels,url; then
  set +e
  node - "$tmp_dir/pr-view.json" "$BRANCH" <<'NODE'
const fs = require("fs");
const file = process.argv[2];
const branch = process.argv[3];
const pr = JSON.parse(fs.readFileSync(file, "utf8"));
const labels = (pr.labels || []).map((label) => label.name).join(",");
const blockers = [];
console.log(`PR url: ${pr.url}`);
console.log(`PR head: ${pr.headRefName} ${pr.headRefOid}`);
console.log(`PR state: ${pr.state}; draft=${pr.isDraft}; reviewDecision=${pr.reviewDecision || "none"}; labels=${labels || "none"}`);
if (pr.headRefName !== branch) blockers.push(`PR head branch does not match ${branch}`);
if ((pr.latestReviews || []).length === 0) blockers.push("PR has no non-author review evidence yet");
if (pr.reviewDecision !== "APPROVED") blockers.push(`PR review decision is ${pr.reviewDecision || "none"}, not APPROVED`);
if ((pr.statusCheckRollup || []).length === 0) blockers.push("PR has no status-check rollup yet");
for (const check of pr.statusCheckRollup || []) {
  const name = check.name || check.workflowName || check.context || check.__typename || "unknown check";
  if (check.conclusion && !["SUCCESS", "NEUTRAL", "SKIPPED"].includes(check.conclusion)) {
    blockers.push(`PR check ${name} conclusion is ${check.conclusion}`);
  }
  if (check.status && !["COMPLETED"].includes(check.status)) {
    blockers.push(`PR check ${name} status is ${check.status}`);
  }
}
if (labels.split(",").includes("reviewer-blocked")) blockers.push("PR still carries reviewer-blocked label");
if (blockers.length > 0) {
  for (const blocker of blockers) console.error(`BLOCK: ${blocker}`);
  process.exit(1);
}
console.log("PASS: PR branch, review, checks, and reviewer label state are release-ready");
NODE
  pr_status=$?
  set -e
  if [[ "$pr_status" -eq 0 ]]; then
    pass "PR gate state acceptable"
  else
    block "PR gate state blocked"
  fi
else
  block "Could not inspect PR ${PR_NUMBER}: $(cat "$tmp_dir/pr-view.json" 2>/dev/null || true)"
fi

if capture "$tmp_dir/pr-checks.txt" gh pr checks "$PR_NUMBER" --repo "$REPO" --watch=false; then
  if [[ -s "$tmp_dir/pr-checks.txt" ]]; then
    pass "PR checks reported"
    sed 's/^/  /' "$tmp_dir/pr-checks.txt"
  else
    block "PR checks command returned no check rows"
  fi
else
  block "PR checks unavailable: $(cat "$tmp_dir/pr-checks.txt" 2>/dev/null || true)"
fi

echo
echo "==> Railway gates"
if capture "$tmp_dir/railway-whoami.txt" railway whoami; then
  pass "Railway CLI authenticated"
  sed 's/^/  /' "$tmp_dir/railway-whoami.txt"
else
  block "Railway CLI unauthenticated: $(cat "$tmp_dir/railway-whoami.txt" 2>/dev/null || true)"
fi

if capture "$tmp_dir/railway-status.txt" railway status; then
  pass "Railway project linked"
  sed 's/^/  /' "$tmp_dir/railway-status.txt"
else
  block "Railway project not linked: $(cat "$tmp_dir/railway-status.txt" 2>/dev/null || true)"
fi

if [[ -n "$RAILWAY_API_URL" ]]; then
  api_health_url="${RAILWAY_API_URL%/}/api/v1/health"
  if curl -fsS "$api_health_url" >"$tmp_dir/railway-health.json"; then
    pass "Railway API health endpoint reachable: ${api_health_url}"
    sed 's/^/  /' "$tmp_dir/railway-health.json"
  else
    block "Railway API health endpoint failed: ${api_health_url}"
  fi
else
  block "RAILWAY_API_URL is not set; hosted API health evidence missing"
fi

echo
echo "==> Vercel gates"
if capture "$tmp_dir/vercel-whoami.txt" vercel whoami; then
  pass "Vercel CLI authenticated"
  sed 's/^/  /' "$tmp_dir/vercel-whoami.txt"
else
  block "Vercel CLI unauthenticated: $(cat "$tmp_dir/vercel-whoami.txt" 2>/dev/null || true)"
fi

if capture "$tmp_dir/vercel-teams.txt" vercel teams ls; then
  pass "Vercel scopes listed"
  sed 's/^/  /' "$tmp_dir/vercel-teams.txt"
else
  block "Could not list Vercel scopes: $(cat "$tmp_dir/vercel-teams.txt" 2>/dev/null || true)"
fi

if [[ -n "$VERCEL_PREVIEW_URL" ]]; then
  if curl -fsS "$VERCEL_PREVIEW_URL" >"$tmp_dir/vercel-preview.html"; then
    pass "Vercel preview reachable: ${VERCEL_PREVIEW_URL}"
    if grep -qi "Live API" "$tmp_dir/vercel-preview.html"; then
      pass "Vercel preview contains Live API marker"
    else
      block "Vercel preview did not expose Live API marker in fetched HTML; run browser verification"
    fi
  else
    block "Vercel preview not reachable: ${VERCEL_PREVIEW_URL}"
  fi
else
  block "VERCEL_PREVIEW_URL is not set; frontend preview evidence missing"
fi

echo
echo "==> Hard gates"
pass "Verifier does not read or print Railway variables, credentials, raw email, raw MIME, raw claim documents, or patient data."
note "Live Send must remain blocked until hospital x insurer/TPA/scheme authority evidence and no-patient-data test-email acknowledgement exist."

echo
if [[ "$failures" -eq 0 ]]; then
  echo "External release gates passed."
else
  echo "External release gates blocked: ${failures} blocker(s)." >&2
  exit 1
fi
