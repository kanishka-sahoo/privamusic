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
# With the tailnet profile, ask each sidecar for the hostname Tailscale assigned it.
tailnet_url() {
  docker compose ps -q "$1" 2>/dev/null | grep -q . || return 0
  docker compose exec -T "$1" tailscale status --self --json 2>/dev/null | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const n=JSON.parse(s).Self.DNSName.replace(/\.$/,"");if(n)console.log("https://"+n+"/");}catch{}})'
}
DASHBOARD_TAILNET_URL="$(tailnet_url tailscale-dashboard)"
NAVIDROME_TAILNET_URL="$(tailnet_url tailscale-navidrome)"
export DASHBOARD_TAILNET_URL NAVIDROME_TAILNET_URL
node --input-type=module - <<'JS'
import {readFileSync,writeFileSync} from 'node:fs';
import {parseEnv} from 'node:util';
const env=parseEnv(readFileSync('.env','utf8'));
const dashboard=process.env.DASHBOARD_PORT||env.DASHBOARD_PORT||18780;
const library=process.env.NAVIDROME_PORT||env.NAVIDROME_PORT||4533;
const urls=[['Dashboard',`http://localhost:${dashboard}`,process.env.DASHBOARD_TAILNET_URL],['Navidrome',`http://localhost:${library}`,process.env.NAVIDROME_TAILNET_URL]];
const lines=urls.flatMap(([name,local,tailnet])=>[`${name}: ${local}`,...(tailnet?[`${name} (tailnet): ${tailnet}`]:[])]);
writeFileSync('build/ACCESS.md',`# PrivaMusic access\n\n${lines.join('\n\n')}\n\nEmail: ${env.DASHBOARD_USER}\n\nDashboard password: \`${env.DASHBOARD_PASSWORD}\`\n\nNavidrome password: \`${env.NAVIDROME_PASSWORD||env.DASHBOARD_PASSWORD}\`\n\nEach service has its own login. Ports bind to localhost by default.\n`,{mode:0o600});
for(const line of lines)console.log(line);
if(env.COMPOSE_PROFILES?.includes('tailnet')&&!process.env.DASHBOARD_TAILNET_URL)console.log('Tailnet sidecars are still joining; check `docker compose logs tailscale-dashboard` and rerun for the URLs.');
console.log('Login details: build/ACCESS.md');
JS
