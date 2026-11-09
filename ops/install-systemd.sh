#!/usr/bin/env bash
# Install the Next.js service and production timers once on the VPS.
set -Eeuo pipefail
[[ "$EUID" -eq 0 ]] || { echo "run as root"; exit 1; }
[[ -d /srv/knight/current ]] || { echo "deploy the app first"; exit 1; }
install -m 0644 /srv/knight/current/ops/systemd/knight-next.service /etc/systemd/system/knight-next.service
install -m 0644 /srv/knight/current/ops/systemd/knight-publish-due.service /etc/systemd/system/knight-publish-due.service
install -m 0644 /srv/knight/current/ops/systemd/knight-publish-due.timer /etc/systemd/system/knight-publish-due.timer
install -m 0644 /srv/knight/current/ops/systemd/knight-backup.service /etc/systemd/system/knight-backup.service
install -m 0644 /srv/knight/current/ops/systemd/knight-backup.timer /etc/systemd/system/knight-backup.timer
systemctl daemon-reload
systemctl enable --now knight-next.service
systemctl enable --now knight-publish-due.timer
systemctl enable --now knight-backup.timer
systemctl --no-pager --full status knight-next.service knight-publish-due.timer knight-backup.timer | sed -n '1,120p'
