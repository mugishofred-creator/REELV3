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


def test_newey_west_ignores_non_finite_values():
    """Régression : un seul NaN renvoyait exactement 0.0, pas NaN.

    Un échec silencieux dans le sens « non significatif » est la pire direction
    possible — il masque un vrai résultat. Mesuré sur données réelles : une
    série de 5 081 barres contenant un seul NaN renvoyait 0.00 au lieu de 2.45.
    """
    rng = np.random.default_rng(21)
    clean = pd.Series(rng.normal(0.0008, 0.01, 2000))
    reference = carry.newey_west_tstat(clean, lags=7)
    assert abs(reference) > 2

    polluted = clean.copy()
    polluted.iloc[0] = np.nan
    polluted.iloc[500] = np.inf
    contaminated = carry.newey_west_tstat(polluted, lags=7)

    assert np.isfinite(contaminated)
    assert contaminated != 0.0
    assert abs(contaminated - reference) < 0.2      # les deux valeurs écartées


def test_newey_west_returns_nan_when_it_cannot_compute():
    """Échec explicite plutôt que zéro trompeur."""
    assert np.isnan(carry.newey_west_tstat(pd.Series([np.nan] * 50), lags=7))
    assert np.isnan(carry.newey_west_tstat(pd.Series([0.01, 0.02]), lags=7))
    assert np.isnan(carry.newey_west_tstat(pd.Series([0.0] * 100), lags=7))


def test_newey_west_detects_a_genuinely_strong_mean():
    rng = np.random.default_rng(5)
    strong = pd.Series(rng.normal(0.002, 0.005, 2000))
    assert carry.newey_west_tstat(strong) > 2.0


# --------------------------------------------------------------------------- #
# Alpha contre une référence
# --------------------------------------------------------------------------- #
def test_alpha_tstat_detects_a_real_alpha():
    rng = np.random.default_rng(9)
    n = 3000
    benchmark = pd.Series(rng.normal(0.0003, 0.01, n))
    # Stratégie = beta 1 sur la référence + un alpha franc.
    strategy = benchmark + rng.normal(0.0006, 0.004, n)

    result = carry.alpha_tstat(strategy, benchmark)
    assert result["beta"] == pytest.approx(1.0, abs=0.05)
    assert result["alpha_annuel"] > 0.1
    assert result["significatif"]


def test_alpha_tstat_rejects_pure_beta():
    """Une stratégie qui n'est qu'un levier sur la référence n'a pas d'alpha."""
    rng = np.random.default_rng(10)
    benchmark = pd.Series(rng.normal(0.0004, 0.012, 3000))
    strategy = 1.3 * benchmark + rng.normal(0.0, 0.003, 3000)   # levier + bruit centré

    result = carry.alpha_tstat(strategy, benchmark)
    assert result["beta"] == pytest.approx(1.3, abs=0.02)
    assert not result["significatif"]


def test_alpha_tstat_handles_perfect_collinearity():
    """Un levier pur donne des résidus nuls : la t-stat diviserait par zéro."""
    rng = np.random.default_rng(13)
    benchmark = pd.Series(rng.normal(0.0004, 0.012, 500))
    result = carry.alpha_tstat(2.0 * benchmark, benchmark)
    assert np.isfinite(result["tstat"])
    assert not result["significatif"]


def test_testing_residual_means_would_always_give_zero():
    """Le piège qui a produit des t-stats de 0.00 pendant cette recherche.

    Les résidus d'une régression OLS avec constante sont orthogonaux à
    l'intercept : leur moyenne est **exactement** nulle, quelle que soit la
    stratégie. Tester cette moyenne ne mesure rien. Il faut la t-stat du
    coefficient alpha lui-même.
    """
    rng = np.random.default_rng(11)
    benchmark = pd.Series(rng.normal(0.0004, 0.012, 2000))
    strategy = benchmark + rng.normal(0.001, 0.005, 2000)   # alpha massif

    X = np.column_stack([np.ones(len(benchmark)), benchmark.to_numpy()])
    coefficients, *_ = np.linalg.lstsq(X, strategy.to_numpy(), rcond=None)
    residuals = strategy.to_numpy() - X @ coefficients

    assert residuals.mean() == pytest.approx(0.0, abs=1e-12)   # toujours zéro
    assert carry.alpha_tstat(strategy, benchmark)["significatif"]  # l'alpha, lui, existe
