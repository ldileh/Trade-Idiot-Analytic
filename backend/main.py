"""Entry point for the Trade-Idiot-Analytic backend.

Runs a FastAPI app with uvicorn. When packaged as a Tauri sidecar, the Tauri
shell launches this executable and passes the port via the BACKEND_PORT env var
(falling back to a default). The server binds to 127.0.0.1 only — it is a local
sidecar, never exposed on the network.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

import uvicorn
from dotenv import load_dotenv

# Load .env before importing the app, so module-level os.getenv reads (e.g.
# FINNHUB_API_KEY in services.data) pick the key up. Look beside the executable
# first so a portable build reads a .env the user dropped next to the app exe;
# when frozen, sys.executable is the sidecar exe. Fall back to cwd-walk for dev.
_exe_env = Path(sys.executable).resolve().parent / ".env"
load_dotenv(_exe_env if _exe_env.exists() else None)

from app import create_app  # noqa: E402  (import after env is loaded)

app = create_app()


def main() -> None:
    host = os.environ.get("BACKEND_HOST", "127.0.0.1")
    port = int(os.environ.get("BACKEND_PORT", "8756"))
    uvicorn.run(app, host=host, port=port, log_level="info")


if __name__ == "__main__":
    main()
