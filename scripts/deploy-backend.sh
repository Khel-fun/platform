#!/usr/bin/env bash
set -euo pipefail

# ------------------------------------------------------------------
# deploy.sh — build & (re)start the platform backend under pm2.
# Assumes pm2 is installed GLOBALLY (pnpm add -g pm2).
# Safe to run non-interactively (CI over SSH) or by hand:
#     bash scripts/deploy.sh      # <-- run with bash, never `. deploy.sh`
# ------------------------------------------------------------------

# 1. Make node / pnpm / GLOBAL pm2 available in a NON-interactive shell.
#    A non-login SSH command does NOT source ~/.bashrc, so we load nvm
#    and put pnpm's global bin (where global pm2 lives) on PATH ourselves.
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

export PNPM_HOME="$HOME/.local/share/pnpm"          # pnpm global bin dir
# global binaries actually live in $PNPM_HOME/bin — add both to be layout-proof
export PATH="$PNPM_HOME:$PNPM_HOME/bin:$PATH"

corepack enable >/dev/null 2>&1 || true             # ensures pnpm is available

PROJECT_DIR="$HOME/platform"
SERVER_DIR="$PROJECT_DIR/apps/server"
ARTIFACT="$SERVER_DIR/dist/index.mjs"
PM2_APP="platform-server"

echo "==> [$(date -u +%FT%TZ)] deploy start"

cd "$PROJECT_DIR"

# 2. Sync working tree to remote main, exactly — no merge prompts, no
#    conflicts. Tracked files are overwritten; UNTRACKED files (your
#    gitignored .env) are left untouched.
git fetch origin main
git checkout main
git reset --hard origin/main
echo "==> now at $(git rev-parse --short HEAD): $(git log -1 --pretty=%s)"

# 3. Install (in case the lockfile changed) and build only the server.
pnpm install --frozen-lockfile
pnpm --filter server build

# 4. Fail fast if the expected artifact isn't there.
if [[ ! -f "$ARTIFACT" ]]; then
  echo "ERROR: build artifact missing: $ARTIFACT" >&2
  exit 1
fi
echo "==> artifact OK: $ARTIFACT"

# 5. (Re)start under GLOBAL pm2, non-interactively.
cd "$SERVER_DIR"
if pm2 describe "$PM2_APP" >/dev/null 2>&1; then
  pm2 reload "$PM2_APP" --update-env
else
  pm2 start "$ARTIFACT" --name "$PM2_APP" \
    --max-memory-restart 1500M --update-env
fi

# 6. Persist the process list so it survives a VM reboot.
pm2 save

# 7. Status + a snapshot of logs. --nostream is critical: plain
#    `pm2 logs` streams forever and would hang a CI job.
pm2 list
pm2 logs "$PM2_APP" --lines 30 --nostream || true

# 8. Optional health check — fail loudly if port 3000 is dead.
if command -v curl >/dev/null 2>&1; then
  sleep 3
  curl -fsS http://localhost:3000/health >/dev/null \
    && echo "==> health check passed" \
    || echo "WARN: health check did not pass (no /health route?)"
fi

echo "==> deploy done"
