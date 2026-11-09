#!/bin/bash
set -u
cd /home/knight/jiro
TOKEN="$(cat /home/knight/jiro/internal-token 2>/dev/null || true)"
if [ -n "$TOKEN" ] && curl -fsS --max-time 5 -H "X-Knight-Internal-Token: ${TOKEN}" http://127.0.0.1:8010/health >/dev/null 2>&1; then
  exit 0
fi
/home/knight/jiro/stop.sh >/dev/null 2>&1 || true
/home/knight/jiro/start.sh >/dev/null 2>&1 || true
echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Jiro watchdog restarted service" >> /home/knight/jiro/logs/watchdog.log
