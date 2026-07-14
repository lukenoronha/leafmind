"""Minimal GitHub push-webhook receiver: verifies the HMAC signature, then
runs `git pull && docker compose up -d --build` on the host repo.

Deliberately dependency-light (stdlib + FastAPI only) since this container's
only job is to trigger a redeploy — it is not part of the application.
"""

import hashlib
import hmac
import os
import subprocess

from fastapi import FastAPI, Header, HTTPException, Request

app = FastAPI()

WEBHOOK_SECRET = os.environ["WEBHOOK_SECRET"]
REPO_DIR = os.environ.get("REPO_DIR", "/repo")
BRANCH = os.environ.get("DEPLOY_BRANCH", "main")


def verify_signature(payload: bytes, signature_header: str | None) -> bool:
    if not signature_header or not signature_header.startswith("sha256="):
        return False
    expected = hmac.new(WEBHOOK_SECRET.encode(), payload, hashlib.sha256).hexdigest()
    return hmac.compare_digest(f"sha256={expected}", signature_header)


@app.post("/webhook")
async def webhook(
    request: Request,
    x_hub_signature_256: str | None = Header(default=None),
    x_github_event: str | None = Header(default=None),
):
    payload = await request.body()

    if not verify_signature(payload, x_hub_signature_256):
        raise HTTPException(status_code=401, detail="Invalid signature")

    if x_github_event != "push":
        return {"status": "ignored", "reason": f"event={x_github_event}"}

    body = await request.json()
    if body.get("ref") != f"refs/heads/{BRANCH}":
        return {"status": "ignored", "reason": f"ref={body.get('ref')}"}

    result = subprocess.run(
        ["/deploy.sh"],
        cwd=REPO_DIR,
        capture_output=True,
        text=True,
        timeout=600,
    )

    return {
        "status": "deployed" if result.returncode == 0 else "failed",
        "returncode": result.returncode,
        "stdout": result.stdout[-4000:],
        "stderr": result.stderr[-4000:],
    }


@app.get("/health")
async def health():
    return {"status": "ok"}
