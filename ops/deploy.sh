#!/usr/bin/env bash
# Safe GitHub-to-VPS deployment for the single-node Knight Medical Billing app.
#
# Run as the dedicated non-root deploy account from a release directory uploaded
# by GitHub Actions:
#   /srv/knight/releases/<sha>/ops/deploy.sh <sha>
#
# Invariants:
#   - Existing systemd service is `knight` (never create knight-next).
#   - SQLite and media remain in /var/lib/knight, outside every release.
#   - Secrets remain in /etc/knight/knight.env, outside every release.
#   - The deploy account builds the release; it is never run as root.
#   - A verified online backup is taken before switching.
#   - Failed health rolls back application code only. The production database is
#     NEVER overwritten automatically; preserve it for recovery/forensics.
#   - SQLITE_REQUIRE_EXISTING=1 and an existing production DB are mandatory.
set -Eeuo pipefail
umask 0027

COMMIT="${1:?usage: deploy.sh <commit-sha>}"
APP_ROOT="${APP_ROOT:-/srv/knight}"
RELEASES="$APP_ROOT/releases"
CURRENT="$APP_ROOT/current"
ENV_FILE="${DEPLOY_ENV_FILE:-/etc/knight/deploy.env}"
BACKUP_ROOT="${BACKUP_ROOT:-}"
SERVICE="${SERVICE:-knight}"
APP_USER="${APP_USER:-knight}"
APP_GROUP="${APP_GROUP:-knight}"
LOG_FILE="${DEPLOY_LOG:-$APP_ROOT/deploy.log}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:3000/api/health}"
EXPECTED_DB="/var/lib/knight/app.db"
RELEASE_DIR="$RELEASES/$COMMIT"

mkdir -p "$(dirname "$LOG_FILE")"
exec > >(tee -a "$LOG_FILE") 2>&1
log() { printf '[deploy %s] %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }
fail() { log "ERROR: $*"; exit 1; }

# Build, npm and release writes must happen as the dedicated deploy account.
[[ "$EUID" -ne 0 ]] || fail "run as the dedicated non-root deploy account, not root"
[[ -d "$RELEASE_DIR" ]] || fail "release directory not found: $RELEASE_DIR"
[[ -r "$ENV_FILE" ]] || fail "missing environment file: $ENV_FILE"
command -v npm >/dev/null || fail "npm not found on PATH"
command -v node >/dev/null || fail "node not found on PATH"
command -v curl >/dev/null || fail "curl not found"
command -v flock >/dev/null || fail "flock not found"
command -v sudo >/dev/null || fail "sudo not found"
command -v mktemp >/dev/null || fail "mktemp not found"
SYSTEMCTL="/usr/bin/systemctl"
[[ -x "$SYSTEMCTL" ]] || fail "systemctl not found at $SYSTEMCTL"
"$SYSTEMCTL" cat "$SERVICE" >/dev/null 2>&1 || fail "existing systemd service '$SERVICE' was not found; do not create a duplicate website service"
id "$APP_USER" >/dev/null 2>&1 || fail "application user '$APP_USER' does not exist"
id -nG | tr ' ' '\n' | grep -qx "$APP_GROUP" || fail "deploy account is not in application group '$APP_GROUP'"

# Preflight EVERY elevated operation before touching a backup, build or symlink.
# `sudo -n -l <command>` checks the sudoers policy without executing restart/stop.
for action in status restart stop start; do
  sudo -n -l "$SYSTEMCTL" "$action" "$SERVICE" >/dev/null 2>&1 || fail "restricted sudo is missing for: $SYSTEMCTL $action $SERVICE"
done

# Serialise deployments on the host, in addition to the GitHub Actions group.
LOCK_FILE="$APP_ROOT/.deploy.lock"
exec 9>"$LOCK_FILE"
flock -n 9 || fail "another deployment is already running"

set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a

BACKUP_ROOT="${BACKUP_ROOT:-${BACKUP_DIR:-/var/backups/knight}}"
[[ "$BACKUP_ROOT" = /* ]] || fail "BACKUP_ROOT/BACKUP_DIR must be absolute"

: "${SQLITE_PATH:?SQLITE_PATH must be set in $ENV_FILE}"
[[ "$SQLITE_PATH" == "$EXPECTED_DB" ]] || fail "SQLITE_PATH must be $EXPECTED_DB for this deployment"
[[ -f "$SQLITE_PATH" ]] || fail "production database does not exist at $SQLITE_PATH; first boot must be completed manually"
[[ "${SQLITE_REQUIRE_EXISTING:-}" == "1" ]] || fail "SQLITE_REQUIRE_EXISTING=1 is required"
[[ -n "${NEXT_PUBLIC_SITE_URL:-}" ]] || fail "NEXT_PUBLIC_SITE_URL is not configured"
[[ -d "$(dirname "$SQLITE_PATH")" ]] || fail "database directory is missing: $(dirname "$SQLITE_PATH")"

PREVIOUS=""
if [[ -L "$CURRENT" ]]; then
  PREVIOUS="$(readlink -f "$CURRENT")"
  [[ -d "$PREVIOUS" ]] || fail "current symlink points to a missing release: $PREVIOUS"
fi
[[ -n "$PREVIOUS" ]] || fail "no existing release; complete the one-time manual bootstrap and service setup first"

# Pre-deployment backup. It must precede build/switch so a failed build does not
# leave us without a recovery point.
log "pre-deployment SQLite/media backup"
PRE_BACKUP="$BACKUP_ROOT/predeploy/$COMMIT-$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$PRE_BACKUP"
( cd "$PREVIOUS" && SQLITE_PATH="$SQLITE_PATH" BACKUP_DIR="$PRE_BACKUP" npm run db:backup ) || fail "pre-deployment backup failed"
SNAPSHOT="$(find "$PRE_BACKUP" -mindepth 1 -maxdepth 1 -type d -name '20*' -print 2>/dev/null | sort | tail -1)"
[[ -n "$SNAPSHOT" && -f "$SNAPSHOT/app.db" ]] || fail "pre-deployment backup did not produce app.db"
log "backup: $SNAPSHOT"

log "installing release dependencies"
cd "$RELEASE_DIR"
npm ci || fail "npm ci failed; production database and current release remain untouched"

# The new release has dependencies installed, so verify the backup with the new
# verifier before any switch.
log "verifying backup integrity"
node "$RELEASE_DIR/scripts/verify-backup.mjs" "$SNAPSHOT" || fail "backup verification failed; not switching releases"

# Build against a throwaway SQLite file. Next server components may be imported
# during build; they must never open or migrate the production database.
BUILD_DB_DIR="$(mktemp -d "${TMPDIR:-/tmp}/knight-build-XXXXXX")"
cleanup_build_db() { rm -rf "$BUILD_DB_DIR"; }
trap cleanup_build_db EXIT

log "building release $COMMIT as $(id -un) with isolated build database"
SQLITE_PATH="$BUILD_DB_DIR/app.db" SQLITE_ALLOW_CREATE=1 SQLITE_REQUIRE_EXISTING=0 NODE_ENV=production   npm run build || fail "production build failed; production database and current release remain untouched"
rm -rf "$BUILD_DB_DIR"
trap - EXIT

# Next.js writes image-optimizer and cache data under .next/cache. The release
# is deploy-owned; grant the application group write access ONLY to that cache,
# never to application code, database or media paths.
prepare_runtime_cache() {
  local cache="$RELEASE_DIR/.next/cache"
  mkdir -p "$cache" || return 1
  chgrp -R "$APP_GROUP" "$cache" || return 1
  find "$cache" -type d -exec chmod 2770 {} + || return 1
  find "$cache" -type f -exec chmod 0640 {} + || return 1
}
log "preparing writable Next.js runtime cache (cache only)"
prepare_runtime_cache || fail "could not prepare $RELEASE_DIR/.next/cache for $APP_USER:$APP_GROUP"

switch_release() {
  local target="$1"
  local next_link="$APP_ROOT/.current.next"
  ln -sfn "$target" "$next_link" || return 1
  mv -Tf "$next_link" "$CURRENT" || return 1
}

health_check() {
  local body
  body="$(curl -fsS --max-time 5 "$HEALTH_URL" 2>/dev/null || true)"
  if printf '%s' "$body" | node -e '
    let s = "";
    process.stdin.on("data", (d) => { s += d; });
    process.stdin.on("end", () => {
      try {
        const h = JSON.parse(s);
        if (h.ok !== true) process.exit(1);
        if (!h.stores || !h.stores.sqlite || h.stores.sqlite.available !== true) process.exit(1);
        if (!h.config || h.config.blockingErrors !== 0) process.exit(1);
      } catch { process.exit(1); }
    });
  '; then
    return 0
  fi
  log "health response: ${body:0:500}"
  return 1
}

restart_and_check() {
  # Only the exact service restart is elevated; build and file operations are not.
  sudo -n "$SYSTEMCTL" restart "$SERVICE" || return 1
  for _ in $(seq 1 30); do
    sleep 1
    if health_check; then return 0; fi
  done
  return 1
}

log "switching release"
switch_release "$RELEASE_DIR" || fail "could not switch current symlink"

if restart_and_check; then
  log "deployment successful: $COMMIT"
  exit 0
fi

log "health check failed; rolling back application code ONLY"
log "production database is preserved at $SQLITE_PATH (no automatic restore)"
sudo -n "$SYSTEMCTL" stop "$SERVICE" || true
switch_release "$PREVIOUS" || fail "could not switch back to $PREVIOUS; manual intervention required"
if restart_and_check; then
  log "ROLLBACK SUCCEEDED to $PREVIOUS"
else
  log "ROLLBACK HEALTH CHECK FAILED — manual intervention required; database was not modified"
fi
exit 1
