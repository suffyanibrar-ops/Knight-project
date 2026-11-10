#!/bin/bash
set -eu
cd /home/knight/jiro
if [ ! -f ./jiro.pid ]; then exit 0; fi
pid="$(cat ./jiro.pid)"
if ! kill -0 "$pid" 2>/dev/null; then rm -f ./jiro.pid; exit 0; fi
# Never kill a reused PID that is not our Jiro server.
if tr '\0' ' ' < "/proc/$pid/cmdline" 2>/dev/null | grep -q '/home/knight/jiro/server.py'; then
  kill "$pid" 2>/dev/null || true
else
  echo "[stop] refusing to kill unrelated PID $pid" >&2
fi
rm -f ./jiro.pid
