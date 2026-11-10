#!/bin/bash
set -u
cd /home/knight/jiro
TOKEN_FILE=/home/knight/jiro/internal-token
if [ ! -s "$TOKEN_FILE" ]; then
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Jiro watchdog: internal token missing; not restarting" >> /home/knight/jiro/logs/watchdog.log
  exit 0
fi
if curl -fsS --max-time 5 -K /home/knight/jiro/watchdog-curl.conf http://127.0.0.1:8010/health >/dev/null 2>&1; then
  exit 0
fi
/home/knight/jiro/stop.sh >/dev/null 2>&1 || true
/home/knight/jiro/start.sh >/dev/null 2>&1 || true
echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Jiro watchdog restarted service" >> /home/knight/jiro/logs/watchdog.log
