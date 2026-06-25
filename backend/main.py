"""Entry point for the Trade-Idiot-Analytic backend.

Runs a FastAPI app with uvicorn. When packaged as a Tauri sidecar, the Tauri
shell launches this executable and passes the port via the BACKEND_PORT env var
(falling back to a default). The server binds to 127.0.0.1 only — it is a local
sidecar, never exposed on the network.
"""
from __future__ import annotations

import os

import uvicorn

from app import create_app

app = create_app()


def main() -> None:
    host = os.environ.get("BACKEND_HOST", "127.0.0.1")
    port = int(os.environ.get("BACKEND_PORT", "8756"))
    uvicorn.run(app, host=host, port=port, log_level="info")


if __name__ == "__main__":
    main()
