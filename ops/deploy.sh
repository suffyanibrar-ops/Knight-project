#!/usr/bin/env bash
# Safe GitHub-to-VPS deployment for the single-node Knight Medical Billing app.
#
# Run from a release directory uploaded by GitHub Actions:
#   sudo /srv/knight/releases/<sha>/ops/deploy.sh <sha>
#
# Invariants:
#   - SQLite and media live under /var/lib/knight, never in the release.
#   - Secrets live in /etc/knight/knight.env, never in a release or Git.
#   - The live database is backed up before any build/restart.
#   - A failed health check rolls back the release and restores that backup.
#   - The app's SQLITE_REQUIRE_EXISTING guard is mandatory; a missing DB aborts.
set -Eeuo pipefail

COMMIT="${1:?usage: deploy.sh <commit-sha>}"
APP_ROOT="${APP_ROOT:-/srv/knight}"
RELEASES="$APP_ROOT/releases"
CURRENT="$APP_ROOT/current"
ENV_FILE="${ENV_FILE:-/etc/knight/knight.env}"
BACKUP_ROOT="${BACKUP_ROOT:-/var/backups/knight}"
LOG_FILE="${DEPLOY_LOG:-/var/log/knight-deploy.log}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:3000/api/health}"
SERVICE="${SERVICE:-knight-next}"
RELEASE_DIR="$RELEASES/$COMMIT"

exec > >(tee -a "$LOG_FILE") 2>&1
log() { printf '[deploy %s] %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }
fail() { log "ERROR: $*"; exit 1; }

[[ "$EUID" -eq 0 ]] || fail "run this deployment script as root (or via sudo)"
[[ -d "$RELEASE_DIR" ]] || fail "release directory not found: $RELEASE_DIR"
[[ -r "$ENV_FILE" ]] || fail "missing environment file: $ENV_FILE"
mkdir -p "$BACKUP_ROOT" "$(dirname "$LOG_FILE")"

set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a

: "${SQLITE_PATH:?SQLITE_PATH must be set in $ENV_FILE}"
[[ "$SQLITE_PATH" = /* ]] || fail "SQLITE_PATH must be absolute"
[[ "$SQLITE_PATH" != "$RELEASE_DIR"/* ]] || fail "SQLITE_PATH must never be inside a release"
[[ -f "$SQLITE_PATH" ]] || fail "production database does not exist at $SQLITE_PATH; intentional first boot must be completed manually"
[[ "${SQLITE_REQUIRE_EXISTING:-}" == "1" ]] || fail "SQLITE_REQUIRE_EXISTING=1 is required for production deployments"
[[ -n "${NEXT_PUBLIC_SITE_URL:-}" ]] || fail "NEXT_PUBLIC_SITE_URL is not configured"
[[ -n "${RESEND_API_KEY:-}" || -n "${SMTP_HOST:-}" ]] || log "WARNING: no email provider configured; password-reset email will not deliver"
command -v npm >/dev/null || fail "npm not found on PATH"
command -v curl >/dev/null || fail "curl not found"

PREVIOUS=""
if [[ -L "$CURRENT" ]]; then
  PREVIOUS="$(readlink -f "$CURRENT")"
  [[ -d "$PREVIOUS" ]] || PREVIOUS=""
fi

SNAPSHOT=""
if [[ -n "$PREVIOUS" ]]; then
  log "pre-deployment SQLite/media backup"
  PRE_BACKUP="$BACKUP_ROOT/predeploy"
  ( cd "$PREVIOUS" && SQLITE_PATH="$SQLITE_PATH" BACKUP_DIR="$PRE_BACKUP" npm run db:backup )
  SNAPSHOT="$(find "$PRE_BACKUP" -mindepth 1 -maxdepth 1 -type d -name '20*' -print 2>/dev/null | sort | tail -1)"
  [[ -n "$SNAPSHOT" && -f "$SNAPSHOT/app.db" ]] || fail "pre-deployment backup did not produce app.db"
  log "backup: $SNAPSHOT"
fi

log "building $COMMIT"
cd "$RELEASE_DIR"
# Build on the VPS so better-sqlite3/sharp match this Linux runtime.
npm ci
NODE_ENV=production npm run build

switch_release() {
  local target="$1"
  local next_link="$APP_ROOT/.current.next"
  ln -sfn "$target" "$next_link"
  mv -Tf "$next_link" "$CURRENT"
}

health_check() {
  local body
  body="$(curl -fsS --max-time 5 "$HEALTH_URL" 2>/dev/null || true)"
  if printf '%s' "$body" | grep -q '"ok":true' && printf '%s' "$body" | grep -q '"available":true'; then
    return 0
  fi
  log "health response: ${body:0:500}"
  return 1
}

restart_and_check() {
  systemctl restart "$SERVICE"
  for _ in $(seq 1 30); do
    sleep 1
    if health_check; then return 0; fi
  done
  return 1
}

log "switching release"
switch_release "$RELEASE_DIR"

if restart_and_check; then
  log "deployment successful: $COMMIT"
  exit 0
fi

log "health check failed; rolling back"
systemctl stop "$SERVICE" || true
if [[ -n "$SNAPSHOT" && -f "$SNAPSHOT/app.db" ]]; then
  log "restoring pre-deployment database and media"
  SOURCE_SQLITE_PATH="$SNAPSHOT/app.db" DEST_SQLITE_PATH="$SQLITE_PATH" OVERWRITE_PRODUCTION=1 npm run db:migrate:production
fi
if [[ -n "$PREVIOUS" ]]; then
  switch_release "$PREVIOUS"
  systemctl start "$SERVICE"
  if health_check; then
    log "ROLLBACK SUCCEEDED to $PREVIOUS; inspect logs and fix before redeploying"
  else
    log "ROLLBACK HEALTH CHECK FAILED — manual intervention required"
  fi
else
  log "no previous release was available for rollback"
fi
exit 1
