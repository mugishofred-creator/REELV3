"""Carry FX et significativité statistique."""

from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from trading_bot import carry


@pytest.fixture
def flat_rates() -> pd.DataFrame:
    index = pd.date_range("2020-01-01", "2021-12-31", freq="D")
    return pd.DataFrame({"USD": 0.02, "HIGH": 0.08, "LOW": -0.01}, index=index)


def test_total_return_adds_the_rate_differential(flat_rates):
    index = pd.bdate_range("2020-06-01", periods=10)
    spot = pd.DataFrame(0.0, index=index, columns=["HIGH", "LOW"])
    total, differential = carry.total_returns(spot, flat_rates)

    assert differential["HIGH"].iloc[0] == pytest.approx(0.06)    # 8 % − 2 %
    assert differential["LOW"].iloc[0] == pytest.approx(-0.03)    # −1 % − 2 %
    # Spot immobile : tout le rendement vient du portage.
    assert total["HIGH"].iloc[1] == pytest.approx(0.06 / 365)
    assert total["LOW"].iloc[1] == pytest.approx(-0.03 / 365)


def test_weekend_carries_three_days(flat_rates):
    days = pd.to_datetime(["2020-06-05", "2020-06-08"])          # vendredi, lundi
    spot = pd.DataFrame(0.0, index=days, columns=["HIGH"])
    total, _ = carry.total_returns(spot, flat_rates)
    assert total["HIGH"].iloc[1] == pytest.approx(0.06 * 3 / 365)


def test_usd_base_pairs_carry_the_inverting_sign():
    """Six des dix paires cotent USD/xxx. Un signe inversé retournerait le
    carry sur la majorité de l'univers, sans que la magnitude ne le révèle."""
    for ccy in ("JPY", "CHF", "CAD", "SEK", "NOK", "MXN"):
        assert carry.CURRENCY_PAIRS[ccy][1] == -1
    for ccy in ("EUR", "GBP", "AUD", "NZD"):
        assert carry.CURRENCY_PAIRS[ccy][1] == 1


def test_portfolio_is_long_high_yield_and_short_low_yield(flat_rates):
    index = pd.bdate_range("2020-06-01", periods=200)
    spot = pd.DataFrame(0.0, index=index, columns=["HIGH", "LOW"])
    total, differential = carry.total_returns(spot, flat_rates)

    net = carry.carry_portfolio(total, differential, quantile=0.5, cost_bps=0.0)
    # Spot immobile, HIGH paie plus que LOW : le portefeuille doit gagner.
    assert net.sum() > 0


def test_newey_west_is_more_conservative_than_a_naive_tstat():
    """Sur une série autocorrélée positivement, la correction doit réduire la
    t-stat — c'est tout son intérêt."""
    rng = np.random.default_rng(4)
    noise = rng.normal(0.0005, 0.01, 3000)
    autocorrelated = pd.Series(noise).rolling(15, min_periods=1).mean()

    naive = autocorrelated.mean() / autocorrelated.std() * np.sqrt(len(autocorrelated))
    corrected = carry.newey_west_tstat(autocorrelated, lags=21)
    assert abs(corrected) < abs(naive)


def test_newey_west_detects_a_genuinely_strong_mean():
    rng = np.random.default_rng(5)
    strong = pd.Series(rng.normal(0.002, 0.005, 2000))
    assert carry.newey_west_tstat(strong) > 2.0
