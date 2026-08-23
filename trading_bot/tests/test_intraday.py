"""Structure intraday : mesure de la saisonnalité et coût de son exploitation."""

from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from trading_bot import intraday as I


def _session_index(days: int = 200, hours=range(9, 16)) -> pd.DatetimeIndex:
    stamps = []
    day = pd.Timestamp("2024-01-01 00:00")
    for _ in range(days):
        if day.dayofweek < 5:
            stamps += [day + pd.Timedelta(hours=h) for h in hours]
        day += pd.Timedelta(days=1)
    return pd.DatetimeIndex(stamps)


def test_seasonality_r2_detects_a_pure_U_shape():
    """Une volatilité entièrement déterminée par l'heure doit donner R² proche
    de sa part théorique — c'est la mesure directe de « le risque est-il
    prévisible ? », sans aucun modèle."""
    index = _session_index()
    rng = np.random.default_rng(1)
    # Volatilité en U : forte à 9h et 15h, creuse à midi
    scale = {9: 5.0, 10: 2.0, 11: 1.0, 12: 0.8, 13: 1.0, 14: 1.5, 15: 3.0}
    values = np.array([rng.normal(0, scale[t.hour] * 1e-3) for t in index])
    returns = pd.Series(values, index=index)

    assert I.seasonality_r2(returns) > 0.15


def test_seasonality_r2_is_near_zero_without_structure():
    index = _session_index()
    rng = np.random.default_rng(2)
    flat = pd.Series(rng.normal(0, 0.002, len(index)), index=index)
    assert abs(I.seasonality_r2(flat)) < 0.02


def test_hourly_profile_separates_ratio_from_volatility():
    """Le ratio est la colonne qui décide, pas la volatilité.

    Une heure très volatile mais proportionnellement rémunératrice n'offre
    aucune opportunité : c'est ce que le ratio révèle et que la volatilité seule
    masque.
    """
    index = _session_index(300)
    rng = np.random.default_rng(3)
    rows = []
    for t in index:
        # 9h : vol x4 et rendement x4 -> même ratio que 12h
        factor = 4.0 if t.hour == 9 else 1.0
        rows.append(rng.normal(0.0002 * factor, 0.004 * factor))
    prices = pd.DataFrame({"A": 100 * np.exp(np.cumsum(rows))}, index=index)

    table = I.hourly_profile(prices)
    assert table.loc[9, "vol_bps"] > 2 * table.loc[12, "vol_bps"]
    # Ratios comparables malgré des volatilités très différentes.
    assert abs(table.loc[9, "ratio"] - table.loc[12, "ratio"]) < 0.05


def test_hourly_profile_reports_the_multiple_testing_threshold():
    """Une séance compte sept créneaux : sept chances de trouver du bruit."""
    index = _session_index(400)
    rng = np.random.default_rng(4)
    prices = pd.DataFrame(
        {"A": 100 * np.exp(np.cumsum(rng.normal(0, 0.003, len(index))))}, index=index
    )
    table = I.hourly_profile(prices)
    assert table.attrs["n_tests"] == 7
    assert table.attrs["bonferroni_threshold"] > 2.5


def test_hourly_profile_fails_cleanly_when_data_is_too_short():
    """Sans garde-fou, un échantillon trop court levait un KeyError sur une
    colonne absente — une erreur qui n'indique pas la vraie cause."""
    index = _session_index(20)
    rng = np.random.default_rng(9)
    prices = pd.DataFrame(
        {"A": 100 * np.exp(np.cumsum(rng.normal(0, 0.003, len(index))))}, index=index
    )
    table = I.hourly_profile(prices)
    assert table.empty
    assert table.attrs["n_tests"] == 0
    assert np.isnan(table.attrs["bonferroni_threshold"])


def test_holding_one_hour_costs_about_two_transactions_per_day():
    """Le coût est structurel : entrer et sortir chaque jour, c'est ~500
    transactions par an, quelle que soit la qualité du créneau."""
    index = _session_index(250)
    rng = np.random.default_rng(5)
    prices = pd.DataFrame(
        {"A": 100 * np.exp(np.cumsum(rng.normal(0.0001, 0.003, len(index))))}, index=index
    )
    result = I.hold_only_hours(prices, [13], cost_bps=0.0)
    assert 400 < result["transactions_par_an"] < 600


def test_costs_flip_a_frictionless_intraday_gain():
    """Reproduit le résultat réel : un créneau rentable à coût nul devient
    perdant dès 1 bp par côté."""
    index = _session_index(250)
    rng = np.random.default_rng(6)
    rows = [rng.normal(0.0004 if t.hour == 13 else 0.0, 0.003) for t in index]
    prices = pd.DataFrame({"A": 100 * np.exp(np.cumsum(rows))}, index=index)

    free = I.hold_only_hours(prices, [13], cost_bps=0.0)
    costly = I.hold_only_hours(prices, [13], cost_bps=3.0)
    assert free["annualise"] > 0
    assert costly["annualise"] < free["annualise"]
