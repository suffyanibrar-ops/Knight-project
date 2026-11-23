#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

REMOTE="${KNIGHT_VPS_USER:-knight}@${KNIGHT_VPS_HOST:-179.66.136.102}"
SSH_KEY="${KNIGHT_SSH_KEY:-$HOME/.ssh/id_ed25519}"
APP_ROOT="/srv/knight"
RELEASE="manual-$(date -u +%Y%m%dT%H%M%SZ)"
RELEASE_DIR="$APP_ROOT/releases/$RELEASE"
HEALTH_URL="https://www.knightmedicalbilling.com/api/health"

fail() { echo "ERROR: $*" >&2; exit 1; }

command -v npm >/dev/null || fail "npm is missing"
command -v rsync >/dev/null || fail "rsync is missing"
command -v ssh >/dev/null || fail "ssh is missing"
command -v curl >/dev/null || fail "curl is missing"
[[ -f "$SSH_KEY" ]] || fail "SSH key not found"

echo "==> Running local checks"
npm run typecheck
npm run lint
npm run test:deploy-safety

echo "==> Checking VPS access and production prerequisites"
SSH=(ssh -o IdentitiesOnly=yes -i "$SSH_KEY" "$REMOTE")
"${SSH[@]}" "test -r /etc/knight/deploy.env &&
test -f /var/lib/knight/app.db &&
test -x /srv/knight/current/ops/deploy.sh &&
test -d /srv/knight/releases"

echo "==> Creating isolated release: $RELEASE"
"${SSH[@]}" "mkdir '$RELEASE_DIR'"

echo "==> Uploading project (production data and secrets excluded)"
rsync -az --delete \
  -e "ssh -o IdentitiesOnly=yes -i $SSH_KEY" \
  --exclude='.git/' \
  --exclude='.next/' \
  --exclude='node_modules/' \
  --exclude='data/' \
  --exclude='blog-media/' \
  --exclude='.env' \
  --exclude='.env.*' \
  --exclude='preview/' \
  --exclude='*.tsbuildinfo' \
  --exclude='coverage/' \
  --exclude='test-results/' \
  --exclude='playwright-report/' \
  "$ROOT/" "$REMOTE:$RELEASE_DIR/"

echo "==> Running protected VPS deployment"
"${SSH[@]}" "cd '$RELEASE_DIR' && ./ops/deploy.sh '$RELEASE'"

echo "==> Verifying public website health"
BODY="$(curl -fsS --max-time 20 "$HEALTH_URL")" ||
  fail "public health endpoint could not be reached"

printf '%s' "$BODY" | node -e '
let s = "";
process.stdin.on("data", d => s += d);
process.stdin.on("end", () => {
  try {
    const h = JSON.parse(s);
    if (h.ok !== true) process.exit(1);
    console.log("Health check: OK");
  } catch { process.exit(1); }
});
' || fail "public health check did not return ok:true"

echo "DEPLOYMENT SUCCESSFUL: $RELEASE"
