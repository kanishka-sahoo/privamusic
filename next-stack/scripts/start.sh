#!/bin/sh
set -eu
mkdir -p /data /music /run
rm -f /run/next-bridge.js
node /opt/privamusic/src/server.mjs &
server_pid=$!
Xvfb :99 -screen 0 1280x900x24 &
x_pid=$!
trap 'kill "$server_pid" "$x_pid" "${app_pid:-}" "${vnc_pid:-}" 2>/dev/null || true; wait' TERM INT EXIT
count=0
while [ ! -f /run/next-bridge.js ]; do
  kill -0 "$server_pid"
  count=$((count+1)); [ "$count" -lt 100 ] || exit 1
  sleep 0.1
done
sleep 1
LD_PRELOAD=/opt/privamusic/bridge-inject.so dbus-run-session /app/AppRun &
app_pid=$!
x11vnc -display :99 -localhost -rfbport 5900 -forever -shared -nopw -noxdamage -quiet > /data/native-desktop.log 2>&1 &
vnc_pid=$!
while kill -0 "$server_pid" 2>/dev/null && kill -0 "$app_pid" 2>/dev/null && kill -0 "$vnc_pid" 2>/dev/null; do sleep 2; done
exit 1
