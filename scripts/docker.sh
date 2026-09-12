# Shared Docker access helper. Source this file from the deployment scripts.
if command docker info >/dev/null 2>&1; then
  docker() { command docker "$@"; }
else
  # sudo may ask for the host's password when passwordless Docker access is unavailable.
  docker() { sudo docker "$@"; }
fi
