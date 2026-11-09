#!/bin/bash
set -eu
cd /home/knight/jiro
if [ -f ./jiro.pid ]; then
  kill "$(cat ./jiro.pid)" 2>/dev/null || true
  rm -f ./jiro.pid
fi
