#!/bin/sh
set -eu

cd "$REPO_DIR"
git fetch origin "$DEPLOY_BRANCH"
git reset --hard "origin/$DEPLOY_BRANCH"
docker compose up -d --build
# nginx caches upstream container IPs at startup; recreated backend/frontend
# containers get new IPs on every deploy, so nginx must always restart too.
docker compose restart nginx
