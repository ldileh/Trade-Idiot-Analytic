"""Backtest strategies and runner built on the `backtesting` library.

`backtesting.py` expects a DataFrame with Open/High/Low/Close/Volume columns
(our normalized schema already matches). Strategy parameters are injected as
class attributes before running so the same class serves different configs.
"""
from __future__ import annotations

import pandas as pd
from backtesting import Backtest, Strategy
from backtesting.lib import crossover
from ta.momentum import RSIIndicator
from ta.trend import SMAIndicator


def _sma(series: pd.Series, window: int) -> pd.Series:
    return SMAIndicator(pd.Series(series), window=window).sma_indicator()


def _rsi(series: pd.Series, window: int) -> pd.Series:
    return RSIIndicator(pd.Series(series), window=window).rsi()


class SmaCross(Strategy):
    """Go long when the fast SMA crosses above the slow SMA, exit on the reverse."""

    fast = 10
    slow = 30

    def init(self) -> None:
        close = pd.Series(self.data.Close)
        self.sma_fast = self.I(_sma, close, self.fast)
        self.sma_slow = self.I(_sma, close, self.slow)

    def next(self) -> None:
        if crossover(self.sma_fast, self.sma_slow):
            self.position.close()
            self.buy()
        elif crossover(self.sma_slow, self.sma_fast):
            self.position.close()


class RsiReversion(Strategy):
    """Mean reversion: buy when RSI dips below `lower`, sell when above `upper`."""

    rsi_period = 14
    lower = 30
    upper = 70

    def init(self) -> None:
        close = pd.Series(self.data.Close)
        self.rsi = self.I(_rsi, close, self.rsi_period)

    def next(self) -> None:
        if self.rsi[-1] < self.lower and not self.position:
            self.buy()
        elif self.rsi[-1] > self.upper and self.position:
            self.position.close()


def run_backtest(df: pd.DataFrame, params) -> tuple[pd.Series, pd.DataFrame]:
    """Run a backtest, returning (stats Series, equity_curve DataFrame).

    `params` is the validated BacktestRequest. The equity curve is taken from the
    library's per-bar `_equity_curve` result frame.
    """
    if params.strategy == "sma_cross":
        if params.fast >= params.slow:
            raise ValueError("`fast` period must be smaller than `slow`.")
        strategy_cls = SmaCross
        kwargs = {"fast": params.fast, "slow": params.slow}
    elif params.strategy == "rsi_reversion":
        if params.rsi_lower >= params.rsi_upper:
            raise ValueError("`rsi_lower` must be smaller than `rsi_upper`.")
        strategy_cls = RsiReversion
        kwargs = {
            "rsi_period": params.rsi_period,
            "lower": params.rsi_lower,
            "upper": params.rsi_upper,
        }
    else:
        raise ValueError(f"Unknown strategy: {params.strategy!r}")

    bt = Backtest(
        df,
        strategy_cls,
        cash=params.cash,
        commission=params.commission,
    )
    stats = bt.run(**kwargs)
    equity_curve = stats["_equity_curve"]
    return stats, equity_curve
