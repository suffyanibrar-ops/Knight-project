"""Knight's loopback wrapper around the self-hosted Jiro ASGI app.

Install this file at /home/knight/jiro/server.py. It adds a private token gate
because Jiro's current free-tier auth gate rejects valid authenticated free keys.
The service is bound to 127.0.0.1 only. Never expose it publicly.
"""
import hmac
import os
from pathlib import Path

from starlette.types import ASGIApp, Receive, Scope, Send
from uvicorn import run
from jiro.server import create_app

TOKEN_FILE = Path("/home/knight/jiro/internal-token")
PUBLIC_PATHS = {"/"}


def token_value() -> str:
    return os.environ.get("JIRO_INTERNAL_TOKEN", "").strip() or TOKEN_FILE.read_text().strip()


class PrivateTokenGate:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        path = scope.get("path", "")
        if path not in PUBLIC_PATHS:
            headers = {k.lower(): v for k, v in scope.get("headers", [])}
            supplied = headers.get(b"x-knight-internal-token", b"").decode("latin1")
            expected = token_value()
            if not expected or not hmac.compare_digest(supplied, expected):
                await send({"type": "http.response.start", "status": 403,
                            "headers": [(b"content-type", b"application/json")]})
                await send({"type": "http.response.body", "body": b'{"error":"forbidden"}'})
                return
        await self.app(scope, receive, send)


if __name__ == "__main__":
    app = create_app(config_path="/home/knight/jiro/config.yaml")
    run(PrivateTokenGate(app), host="127.0.0.1", port=8010, workers=1, log_level="info")
