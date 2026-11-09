#!/usr/bin/env bash
# Systemd preflight / optional timer installation.
#
# Default (--check) makes NO changes. Timers are intentionally NOT enabled here;
# enabling them is a separate, explicitly approved post-deployment step.
#
# This script never installs a second website service. The existing `knight`
# service is the only website service.
set -Eeuo pipefail

MODE="${1:---check}"
SERVICE="knight"
ROOT="/srv/knight/current"
SYSTEMCTL="/usr/bin/systemctl"

if [[ "$MODE" == "--check" ]]; then
  "$SYSTEMCTL" cat "$SERVICE" >/dev/null || { echo "ERROR: existing service '$SERVICE' not found"; exit 1; }
  echo "Existing website service: $SERVICE"
  "$SYSTEMCTL" cat "$SERVICE" | grep -E '^(Description|User|WorkingDirectory|EnvironmentFile|ExecStart)=' || true
  for unit in knight-publish-due.service knight-publish-due.timer knight-backup.service knight-backup.timer; do
    [[ -f "$ROOT/ops/systemd/$unit" ]] || { echo "MISSING: $ROOT/ops/systemd/$unit"; exit 1; }
    echo "Available later (not enabled): $unit"
  done
  echo "No changes made."
  exit 0
fi

if [[ "$MODE" != "--install-timers" ]]; then
  echo "usage: $0 [--check|--install-timers]"
  echo "Timers are installed but never enabled by this script; enabling requires separate approval."
  exit 2
fi
[[ "$EUID" -eq 0 ]] || { echo "run with sudo for unit changes"; exit 1; }
"$SYSTEMCTL" cat "$SERVICE" >/dev/null || { echo "ERROR: existing service '$SERVICE' not found"; exit 1; }
[[ -d "$ROOT" ]] || { echo "ERROR: $ROOT not found"; exit 1; }
for unit in knight-publish-due.service knight-publish-due.timer knight-backup.service knight-backup.timer; do
  install -m 0644 "$ROOT/ops/systemd/$unit" "/etc/systemd/system/$unit"
done
"$SYSTEMCTL" daemon-reload
echo "Timer units installed but NOT enabled. Approval is still required."
echo "When later approved, inspect and enable them explicitly with systemctl."
exit 0
