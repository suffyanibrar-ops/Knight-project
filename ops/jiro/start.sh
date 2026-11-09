#!/bin/bash
set -eu
cd /home/knight/jiro
mkdir -p logs data
if [ -f ./jiro.pid ] && kill -0 "$(cat ./jiro.pid)" 2>/dev/null; then exit 0; fi
nohup /home/knight/jiro/.venv/bin/python /home/knight/jiro/server.py >> /home/knight/jiro/logs/jiro.out 2>&1 &
pid=$!
echo "$pid" > ./jiro.pid
exit 0
