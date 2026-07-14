#!/bin/bash
# Polls origin for new commits and deploys if found. Run this via cron
# (e.g. every 2 minutes) as an alternative to the GitHub push webhook —
# no public URL required, so nothing to break when a tunnel URL rotates.
#
# Usage: REPO_DIR=/path/to/leafmind ./cron-deploy.sh (REPO_DIR defaults to
# this script's parent's parent directory if unset).
set -eu

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="${REPO_DIR:-$(dirname "$SCRIPT_DIR")}"
BRANCH="${DEPLOY_BRANCH:-main}"
LOG_FILE="${LOG_FILE:-$REPO_DIR/../leafmind-deploy.log}"

cd "$REPO_DIR"
git fetch -q origin "$BRANCH"

LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse "origin/$BRANCH")

if [ "$LOCAL" = "$REMOTE" ]; then
  exit 0
fi

echo "[$(date -Iseconds)] New commits detected ($LOCAL -> $REMOTE), deploying..." >> "$LOG_FILE"
git reset --hard "origin/$BRANCH" >> "$LOG_FILE" 2>&1
docker compose up -d --build >> "$LOG_FILE" 2>&1
docker compose restart nginx >> "$LOG_FILE" 2>&1
echo "[$(date -Iseconds)] Deploy complete." >> "$LOG_FILE"
