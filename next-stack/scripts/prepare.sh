#!/bin/sh
# Run from any directory. Requires Linux x86_64, Node 24, npm, gcc, Python3 and Docker.
set -eu
cd "$(dirname "$0")/.."
. ./scripts/docker.sh
mkdir -p build/data build/music build/navidrome build/session build/runtime
chmod 700 build/data build/session build/navidrome
chmod 755 build/music
if [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 24 ]; then echo 'Node 24 or newer is required' >&2; exit 1; fi
if [ ! -x build/app/AppRun ]; then
  python3 - <<'PY'
import zipfile, pathlib
with zipfile.ZipFile('../spotiflac-next.zip') as z:
    entries=[n for n in z.namelist() if n.endswith('.AppImage')]
    if len(entries)!=1: raise SystemExit('Expected one AppImage in spotiflac-next.zip')
    pathlib.Path('build/SpotiFLAC-Next.AppImage').write_bytes(z.read(entries[0]))
PY
  chmod +x build/SpotiFLAC-Next.AppImage
  (cd build && ./SpotiFLAC-Next.AppImage --appimage-extract >/dev/null && mv squashfs-root app)
fi
cp "$(command -v node)" build/node
cp /etc/ssl/certs/ca-certificates.crt build/runtime/ca-certificates.crt
gcc -shared -fPIC -O2 -Wall -Wextra -o build/bridge-inject.so native/inject.c -ldl
npm ci --ignore-scripts
if [ ! -f .env ]; then
  umask 077
  node --input-type=module - <<'JS' > .env
import {randomBytes} from 'node:crypto';
console.log('DASHBOARD_USER=social@ksahoo.com');
console.log('DASHBOARD_PASSWORD='+randomBytes(24).toString('base64url'));
console.log('SESSION_SECRET='+randomBytes(32).toString('hex'));
console.log('DASHBOARD_PORT=18780');
console.log('NAVIDROME_PORT=4533');
const session=process.env.NEXT_SESSION_DIR;
if(session)console.log('NEXT_SESSION_DIR='+session);
JS
fi
# Invoke using a Docker-enabled account (or sudo -E with Node/npm in PATH).
docker build -f native/Dockerfile.gui -t privamusic-spotiflac-gui:local build/runtime
docker compose build
printf '%s\n' 'Docker images prepared.'
