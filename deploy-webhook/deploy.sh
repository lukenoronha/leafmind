#!/bin/sh
set -eu

cd "$REPO_DIR"
git fetch origin "$DEPLOY_BRANCH"
git reset --hard "origin/$DEPLOY_BRANCH"
docker compose up -d --build
