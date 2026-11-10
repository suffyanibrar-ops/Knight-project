#!/bin/bash
set -eu
curl -fsS --max-time 120 -X POST -K /home/knight/jiro/automation-curl.conf \
  -H "content-type: application/json" \
  --data '{}' http://127.0.0.1:3000/api/admin/seo/automation/tick
echo
