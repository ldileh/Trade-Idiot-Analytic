"""FastAPI application factory for the Trade-Idiot-Analytic backend."""
from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import backtest, indicators, ownership, patterns, prices, rrg


def create_app() -> FastAPI:
    app = FastAPI(
        title="Trade-Idiot-Analytic API",
        version="0.1.0",
        description="Local sidecar API for US stock technical analysis & backtesting.",
    )

    # The frontend runs in a Tauri webview (tauri://localhost) during release and
    # on the Vite dev server (http://localhost:5173) during development. Since the
    # server only binds to 127.0.0.1, a permissive CORS policy is acceptable here.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/health", tags=["meta"])
    def health() -> dict[str, str]:
        return {"status": "ok"}

    app.include_router(prices.router)
    app.include_router(indicators.router)
    app.include_router(patterns.router)
    app.include_router(rrg.router)
    app.include_router(ownership.router)
    app.include_router(backtest.router)

    return app
