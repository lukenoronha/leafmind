#!/bin/bash
# Keeps a Bitly short link pointed at the current ngrok tunnel URL, since
# free-tier ngrok assigns a new random URL whenever the tunnel container
# restarts. Run this via cron — it's a no-op if the URL hasn't changed.
#
# Required env vars: BITLY_TOKEN, BITLY_LINK (e.g. "bit.ly/leafmind")
set -eu

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${ENV_FILE:-$(dirname "$SCRIPT_DIR")/.env}"
LOG_FILE="${LOG_FILE:-$(dirname "$SCRIPT_DIR")/../leafmind-bitly.log}"

# shellcheck disable=SC1090
[ -f "$ENV_FILE" ] && set -a && source "$ENV_FILE" && set +a

: "${BITLY_TOKEN:?BITLY_TOKEN not set}"
: "${BITLY_LINK:?BITLY_LINK not set (e.g. bit.ly/leafmind)}"
NGROK_API="${NGROK_API:-http://localhost:4040/api/tunnels}"

CURRENT_NGROK_URL=$(curl -s "$NGROK_API" | grep -o '"public_url":"https://[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$CURRENT_NGROK_URL" ]; then
  echo "[$(date -Iseconds)] Could not read ngrok URL from $NGROK_API, skipping." >> "$LOG_FILE"
  exit 0
fi

BITLY_CURRENT_TARGET=$(curl -s -H "Authorization: Bearer $BITLY_TOKEN" \
  "https://api-ssl.bitly.com/v4/bitlinks/$BITLY_LINK" | grep -o '"long_url":"[^"]*"' | cut -d'"' -f4)

# Bitly's long_url has a trailing slash; ngrok's public_url doesn't.
if [ "${BITLY_CURRENT_TARGET%/}" = "$CURRENT_NGROK_URL" ]; then
  exit 0
fi

echo "[$(date -Iseconds)] ngrok URL changed ($BITLY_CURRENT_TARGET -> $CURRENT_NGROK_URL), updating Bitly..." >> "$LOG_FILE"

curl -s -X PATCH "https://api-ssl.bitly.com/v4/bitlinks/$BITLY_LINK" \
  -H "Authorization: Bearer $BITLY_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"long_url\": \"$CURRENT_NGROK_URL\"}" >> "$LOG_FILE" 2>&1

echo "" >> "$LOG_FILE"
echo "[$(date -Iseconds)] Bitly update complete." >> "$LOG_FILE"
