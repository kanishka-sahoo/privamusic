#!/bin/sh
# Build and deploy both services, preserving existing credentials, sessions and music.
set -eu
cd "$(dirname "$0")"
for tool in node npm gcc python3 docker; do
  command -v "$tool" >/dev/null 2>&1 || { printf 'Required command not found: %s\n' "$tool" >&2; exit 1; }
done
# Reuse a normal desktop installation on first deployment when available.
if [ ! -f .env ] && [ -z "${NEXT_SESSION_DIR:-}" ] && [ -d "$HOME/.local/share/spotiflac-next" ]; then
  NEXT_SESSION_DIR="$HOME/.local/share/spotiflac-next"
  export NEXT_SESSION_DIR
fi
sh scripts/prepare.sh
. ./scripts/docker.sh
# --remove-orphans also removes the old Cloudflare container when upgrading.
docker compose up -d --remove-orphans --wait --wait-timeout 180
node --input-type=module - <<'JS'
import {readFileSync,writeFileSync} from 'node:fs';
import {parseEnv} from 'node:util';
const env=parseEnv(readFileSync('.env','utf8'));
const dashboard=process.env.DASHBOARD_PORT||env.DASHBOARD_PORT||18780;
const library=process.env.NAVIDROME_PORT||env.NAVIDROME_PORT||4533;
writeFileSync('build/ACCESS.md',`# PrivaMusic access\n\nDashboard: http://localhost:${dashboard}\n\nNavidrome: http://localhost:${library}\n\nEmail: ${env.DASHBOARD_USER}\n\nDashboard password: \`${env.DASHBOARD_PASSWORD}\`\n\nNavidrome password: \`${env.NAVIDROME_PASSWORD||env.DASHBOARD_PASSWORD}\`\n\nEach service has its own login. Ports bind to localhost by default.\n`,{mode:0o600});
console.log(`Dashboard: http://localhost:${dashboard}`);
console.log(`Navidrome: http://localhost:${library}`);
console.log('Login details: build/ACCESS.md');
JS
