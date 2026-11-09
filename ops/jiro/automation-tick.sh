#!/bin/bash
set -eu
SECRET="$(cat /home/knight/jiro/automation-secret)"
curl -fsS --max-time 120 -X POST http://127.0.0.1:3000/api/admin/seo/automation/tick \
  -H "x-knight-automation-secret: ${SECRET}" \
  -H "content-type: application/json" \
  --data '{}'
echo
