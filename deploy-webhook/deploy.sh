#!/bin/sh
set -eu

cd "$REPO_DIR"
BEFORE=$(git rev-parse HEAD)
git fetch origin "$DEPLOY_BRANCH"
git reset --hard "origin/$DEPLOY_BRANCH"
AFTER=$(git rev-parse HEAD)

# The frontend's node_modules lives in an anonymous volume that persists
# across `docker compose up -d --build` — a plain rebuild does NOT rerun
# `npm ci` against it, so a new/changed dependency silently 404s at runtime
# until the volume is dropped. Only pay this cost when package files
# actually changed between deploys.
if git diff --name-only "$BEFORE" "$AFTER" | grep -q '^frontend/package.*\.json$'; then
  echo "frontend/package*.json changed — recreating frontend to refresh node_modules"
  docker compose up -d --build --force-recreate -V frontend
fi

docker compose up -d --build
# nginx caches upstream container IPs at startup; recreated backend/frontend
# containers get new IPs on every deploy, so nginx must always restart too.
docker compose restart nginx
