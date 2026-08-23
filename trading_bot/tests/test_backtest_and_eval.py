"""Backtest et métriques probabilistes."""

from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from trading_bot import backtest, evaluate
from trading_bot.config import BacktestConfig


@pytest.fixture
def prices() -> pd.DataFrame:
    idx = pd.bdate_range("2021-01-01", periods=60)
    close = pd.Series(np.linspace(100, 110, 60), index=idx)
    return pd.DataFrame({"open": close, "high": close, "low": close, "close": close})


def test_execution_lag_prevents_trading_on_the_signal_bar(prices):
    """Une prédiction parfaite sur une seule barre ne doit rien rapporter si le
    lag l'exécute après le mouvement. C'est le biais qui rend n'importe quelle
    stratégie rentable sur le papier."""
    idx = prices.index
    close = prices["close"].copy()
    close.iloc[30] = 200.0          # saut isolé, connu du "modèle" par triche
    frame = prices.assign(close=close, high=close, low=close, open=close)

    predictions = pd.DataFrame(
        {"p": 0.5, "baseline": 0.5, "y": 0.0, "fold": 0}, index=idx
    )
    predictions.loc[idx[30], "p"] = 1.0   # conviction maximale le jour du saut

    cfg = BacktestConfig(execution_lag=1, edge_threshold=0.02, spread_bps=0.0)
    result = backtest.run(frame, predictions, cfg)
    # La position n'est prise qu'en 31, quand le saut est déjà passé — donc le
    # trade capture la *retombée*, pas le gain.
    assert result.total_return < 0


def test_costs_scale_with_turnover(prices):
    idx = prices.index
    rng = np.random.default_rng(0)
    p = pd.Series(rng.uniform(0.3, 0.7, len(idx)), index=idx)
    predictions = pd.DataFrame({"p": p, "baseline": 0.5, "y": 0.0, "fold": 0})

    free = backtest.run(prices, predictions, BacktestConfig(spread_bps=0.0))
    costly = backtest.run(prices, predictions, BacktestConfig(spread_bps=20.0))
    assert costly.total_costs > free.total_costs
    assert costly.total_return < free.total_return
    assert costly.total_costs == pytest.approx(free.turnover * 20.0 / 10_000, rel=1e-6)


def test_position_is_flat_inside_the_dead_zone():
    p = pd.Series([0.50, 0.51, 0.55, 0.45])
    baseline = pd.Series([0.50] * 4)
    pos = backtest.position_from_probability(p, baseline, BacktestConfig(edge_threshold=0.02))
    assert pos.iloc[0] == 0.0        # aucun edge
    assert pos.iloc[1] == 0.0        # edge sous le seuil
    assert pos.iloc[2] > 0           # long
    assert pos.iloc[3] < 0           # short


def test_edge_is_measured_against_the_base_rate_not_against_one_half():
    """Sur un actif qui monte 60 % des jours, annoncer 0.58 est *baissier*."""
    p = pd.Series([0.58])
    pos = backtest.position_from_probability(
        p, pd.Series([0.60]), BacktestConfig(edge_threshold=0.01)
    )
    assert pos.iloc[0] < 0


def test_brier_skill_is_zero_for_the_baseline_itself():
    rng = np.random.default_rng(1)
    y = rng.binomial(1, 0.4, 500).astype(float)
    predictions = pd.DataFrame({"p": 0.4, "baseline": 0.4, "y": y, "fold": 0})
    report = evaluate.evaluate(predictions)
    assert report.brier_skill == pytest.approx(0.0, abs=1e-9)
    assert not report.has_skill


def test_a_perfect_forecast_reaches_skill_one():
    y = np.array([0.0, 1.0] * 100)
    predictions = pd.DataFrame({"p": np.where(y == 1, 1 - 1e-9, 1e-9), "baseline": 0.5,
                                "y": y, "fold": 0})
    report = evaluate.evaluate(predictions)
    assert report.brier_skill > 0.999
    assert report.auc == pytest.approx(1.0)


def test_overconfidence_is_punished_even_when_ranking_is_right():
    """AUC parfait mais probabilités saturées : le classement est bon, la
    probabilité est fausse. C'est exactement ce que ``classification_report``
    ne voit pas."""
    rng = np.random.default_rng(2)
    y = rng.binomial(1, 0.5, 400).astype(float)
    noisy = np.where(y == 1, 0.99, 0.01)
    flipped = rng.random(400) < 0.25
    p = np.where(flipped, 1 - noisy, noisy)          # 25 % de convictions fausses
    report = evaluate.evaluate(pd.DataFrame({"p": p, "baseline": 0.5, "y": y, "fold": 0}))
    assert report.auc > 0.7          # le classement reste bon
    assert report.logloss_skill < 0  # la probabilité, elle, est catastrophique


def test_reliability_table_detects_a_biased_forecaster():
    rng = np.random.default_rng(3)
    y = rng.binomial(1, 0.3, 1000).astype(float)
    p = np.clip(rng.normal(0.6, 0.05, 1000), 0.01, 0.99)   # annonce 0.6, réalité 0.3
    report = evaluate.evaluate(pd.DataFrame({"p": p, "baseline": 0.3, "y": y, "fold": 0}))
    assert report.ece > 0.2
    assert (report.reliability["ecart"] < 0).all()
