"""Technical indicator computation backed by the `ta` library.

Each function takes an OHLCV DataFrame and returns one or more named pandas
Series aligned to the input index. The router serializes these to JSON, turning
NaN (leading warm-up values) into null so the frontend can skip them.
"""
from __future__ import annotations

import pandas as pd
from ta.momentum import RSIIndicator
from ta.trend import EMAIndicator, MACD, SMAIndicator
from ta.volatility import AverageTrueRange, BollingerBands


def compute(df: pd.DataFrame, kind: str, period: int) -> dict[str, pd.Series]:
    """Compute one indicator. Returns {series_name: Series}.

    A single `kind` may produce multiple lines (e.g. MACD -> macd/signal/hist,
    bbands -> upper/mid/lower), hence the dict return.
    """
    close = df["Close"]

    if kind == "sma":
        return {f"SMA_{period}": SMAIndicator(close, window=period).sma_indicator()}

    if kind == "ema":
        return {f"EMA_{period}": EMAIndicator(close, window=period).ema_indicator()}

    if kind == "rsi":
        return {f"RSI_{period}": RSIIndicator(close, window=period).rsi()}

    if kind == "macd":
        macd = MACD(close)
        return {
            "MACD": macd.macd(),
            "MACD_signal": macd.macd_signal(),
            "MACD_hist": macd.macd_diff(),
        }

    if kind == "bbands":
        bb = BollingerBands(close, window=period)
        return {
            f"BB_upper_{period}": bb.bollinger_hband(),
            f"BB_mid_{period}": bb.bollinger_mavg(),
            f"BB_lower_{period}": bb.bollinger_lband(),
        }

    if kind == "atr":
        atr = AverageTrueRange(df["High"], df["Low"], close, window=period)
        return {f"ATR_{period}": atr.average_true_range()}

    raise ValueError(f"Unknown indicator kind: {kind!r}")
