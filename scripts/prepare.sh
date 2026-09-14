#!/bin/sh
# Run from any directory. Requires Linux x86_64, Node 24, npm, gcc, Python3 and Docker.
set -eu
cd "$(dirname "$0")/.."
. ./scripts/docker.sh
mkdir -p build/data build/music build/navidrome build/session build/runtime
chmod 700 build/data build/session build/navidrome
chmod 755 build/music
if [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 24 ]; then echo 'Node 24 or newer is required' >&2; exit 1; fi
# The native downloader is not part of this repository. Download the Linux x86_64 AppImage from
# https://github.com/spotbye/SpotiFLAC-Next/releases and place it (or a zip containing it) in the
# repository root, or point NEXT_APP_ARCHIVE at it. Extraction is skipped once build/app exists.
if [ ! -x build/app/AppRun ]; then
  archive="${NEXT_APP_ARCHIVE:-}"
  if [ -z "$archive" ]; then
    for candidate in spotiflac-next.zip SpotiFLAC-Next.AppImage ./*.AppImage; do
      [ -f "$candidate" ] && { archive="$candidate"; break; }
    done
  fi
  if [ -z "$archive" ] || [ ! -f "$archive" ]; then
    cat >&2 <<'MSG'
SpotiFLAC Next was not found. It is a separate, prebuilt application that this project does not ship.
  1. Download the Linux x86_64 AppImage from https://github.com/spotbye/SpotiFLAC-Next/releases
  2. Place it in the repository root as SpotiFLAC-Next.AppImage (a spotiflac-next.zip containing the
     AppImage also works), or run: NEXT_APP_ARCHIVE=/path/to/SpotiFLAC-Next.AppImage ./deploy.sh
See "Obtaining SpotiFLAC Next" in README.md.
MSG
    exit 1
  fi
  case "$archive" in
    *.zip)
      NEXT_APP_ARCHIVE="$archive" python3 - <<'PY'
import os, zipfile, pathlib
with zipfile.ZipFile(os.environ['NEXT_APP_ARCHIVE']) as z:
    entries=[n for n in z.namelist() if n.endswith('.AppImage')]
    if len(entries)!=1: raise SystemExit('Expected exactly one .AppImage inside the zip archive')
    pathlib.Path('build/SpotiFLAC-Next.AppImage').write_bytes(z.read(entries[0]))
PY
      ;;
    *) cp "$archive" build/SpotiFLAC-Next.AppImage ;;
  esac
  chmod +x build/SpotiFLAC-Next.AppImage
  (cd build && rm -rf squashfs-root && ./SpotiFLAC-Next.AppImage --appimage-extract >/dev/null && mv squashfs-root app)
  rm -f build/SpotiFLAC-Next.AppImage
  printf 'Extracted the native downloader from %s\n' "$archive"
fi
cp "$(command -v node)" build/node
cp /etc/ssl/certs/ca-certificates.crt build/runtime/ca-certificates.crt
gcc -shared -fPIC -O2 -Wall -Wextra -o build/bridge-inject.so native/inject.c -ldl
npm ci --ignore-scripts
npm run build
if [ ! -f .env ]; then
  umask 077
  node --input-type=module - <<'JS' > .env
import {randomBytes} from 'node:crypto';
console.log('DASHBOARD_USER='+(process.env.DASHBOARD_USER||'admin@example.com'));
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
