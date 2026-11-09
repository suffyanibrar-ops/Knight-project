#!/bin/bash
set -eu
cd /srv/knight/current
SQLITE_PATH=/var/lib/knight/app.db /usr/bin/node scripts/publish-due.mjs
