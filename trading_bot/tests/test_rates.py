"""Financement overnight : conventions de signe, prorata, sérialisation."""

from __future__ import annotations

import sqlite3
import time

import numpy as np
import pandas as pd
import pytest

from trading_bot import rates


@pytest.fixture
def flat_rates() -> pd.DataFrame:
    """Taux constants et distincts, pour que chaque signe soit lisible."""
    index = pd.date_range("2024-01-01", "2024-12-31", freq="D")
    return pd.DataFrame(
        {"USD": 0.05, "EUR": 0.03, "JPY": -0.001, "GBP": 0.045,
         "CHF": 0.015, "CAD": 0.04, "AUD": 0.042},
        index=index,
    )


def test_long_eurusd_earns_eur_and_pays_usd(flat_rates):
    """Convention de base : long BASE/QUOTE => taux_BASE − taux_QUOTE."""
    carry = rates.carry_rate("EURUSD=X", flat_rates)
    assert carry.iloc[0] == pytest.approx(0.03 - 0.05)
    assert carry.iloc[0] < 0          # EUR paie moins que l'USD : le long coûte


def test_usd_base_pairs_are_not_inverted(flat_rates):
    """``JPY=X`` est USD/JPY, pas JPY/USD.

    Se tromper de sens inverserait le carry sur trois des six paires du panier —
    l'erreur serait invisible tant qu'on ne regarde que la magnitude.
    """
    assert rates.FX_PAIRS["JPY=X"] == ("USD", "JPY")
    carry = rates.carry_rate("JPY=X", flat_rates)
    assert carry.iloc[0] == pytest.approx(0.05 - (-0.001))
    assert carry.iloc[0] > 0          # long USD/JPY perçoit le différentiel


def test_short_position_inverts_the_carry(flat_rates):
    """Le signe vient de la position, pas d'un cas particulier dans le calcul."""
    index = pd.date_range("2024-03-01", periods=10, freq="D")
    daily = rates.daily_carry("EURUSD=X", index, flat_rates)

    long_carry = (1.0 * daily).sum()
    short_carry = (-1.0 * daily).sum()
    assert short_carry == pytest.approx(-long_carry)
    assert long_carry < 0 < short_carry


def test_weekend_carries_three_days_not_one(flat_rates):
    """Le prorata suit les jours **calendaires** : vendredi → lundi porte trois
    jours de financement. L'ignorer sous-estimerait le swap d'environ 40 % sur
    une stratégie quotidienne."""
    business = pd.to_datetime(["2024-03-07", "2024-03-08", "2024-03-11"])  # jeu, ven, lun
    daily = rates.daily_carry("EURUSD=X", business, flat_rates)

    annual = 0.03 - 0.05
    assert daily.iloc[1] == pytest.approx(annual / 365)        # jeudi -> vendredi
    assert daily.iloc[2] == pytest.approx(annual * 3 / 365)    # vendredi -> lundi


def test_non_fx_positions_are_financed_in_dollars(flat_rates):
    """Un long sur indice ou matière première emprunte des dollars ; un short les
    perçoit."""
    carry = rates.carry_rate("^GSPC", flat_rates)
    assert carry.iloc[0] == pytest.approx(-0.05)

    # base_yield modélise par exemple le dividende d'un indice total return.
    with_dividend = rates.carry_rate("^GSPC", flat_rates, base_yield=0.018)
    assert with_dividend.iloc[0] == pytest.approx(0.018 - 0.05)


def test_negative_policy_rates_are_preserved(flat_rates):
    """CHF et JPY ont réellement coté en négatif ; un clip à zéro fausserait
    précisément les périodes les plus intéressantes."""
    assert flat_rates["JPY"].iloc[0] < 0
    carry = rates.carry_rate("JPY=X", flat_rates)
    assert carry.iloc[0] == pytest.approx(0.05 + 0.001)


def test_cache_round_trip_preserves_the_date_index(tmp_path, monkeypatch):
    """Régression : ``Series.to_json`` encodait l'index en époque-millisecondes
    et la relecture le réinterprétait — tout l'historique retombait en 1969 et
    les taux devenaient NaN **sans lever la moindre erreur**. Le backtest
    affichait alors un financement de 0,00 % en silence.
    """
    original = pd.Series(
        [0.04, 0.04, 0.045],
        index=pd.to_datetime(["2024-01-01", "2024-06-01", "2024-12-01"]),
    )

    path = str(tmp_path / "r.db")
    conn = rates._init_cache(path)
    conn.execute("INSERT OR REPLACE INTO policy_rates VALUES (?,?,?)",
                 ("US", time.time(), original.to_csv()))
    conn.commit()
    conn.close()

    def fail(*args, **kwargs):   # le cache doit suffire
        raise AssertionError("aucun appel réseau ne devait avoir lieu")

    monkeypatch.setattr(rates.requests, "get", fail)
    restored = rates.fetch_policy_rate("USD", path)

    assert restored.index.min().year == 2024
    assert restored.index.equals(original.index)
    np.testing.assert_allclose(restored.to_numpy(), original.to_numpy())


def test_rates_are_forward_filled_not_interpolated(flat_rates, tmp_path, monkeypatch):
    """Un taux directeur *reste* en vigueur entre deux décisions : report en
    avant, jamais d'interpolation qui inventerait des paliers intermédiaires."""
    sparse = pd.Series([0.02, 0.04],
                       index=pd.to_datetime(["2024-01-01", "2024-03-01"]))
    monkeypatch.setattr(rates, "fetch_policy_rate", lambda c, p="": sparse)

    table = rates.load_rates(["USD"], str(tmp_path / "r.db"))
    assert table.loc["2024-02-15", "USD"] == pytest.approx(0.02)   # pas 0.03
    assert table.loc["2024-02-29", "USD"] == pytest.approx(0.02)   # jusqu'à la veille
    assert table.loc["2024-03-01", "USD"] == pytest.approx(0.04)   # puis le nouveau palier
    # Le calendrier s'arrête à la dernière observation : au-delà, c'est à
    # daily_carry de reporter la dernière valeur connue.
    assert table.index.max() == pd.Timestamp("2024-03-01")


def test_carry_is_zero_before_the_first_known_rate(flat_rates):
    """Un historique de prix plus ancien que les taux ne doit pas produire de
    NaN qui contamineraient silencieusement tout le rendement du portefeuille."""
    early = pd.date_range("2023-11-01", "2024-01-05", freq="B")
    daily = rates.daily_carry("EURUSD=X", early, flat_rates)

    assert daily.notna().all()
    assert (daily.loc[:"2023-12-31"] == 0.0).all()      # avant les taux : neutre
    assert (daily.loc["2024-01-02":] != 0.0).all()      # ensuite : appliqué


def test_unknown_currency_is_rejected(flat_rates):
    with pytest.raises(rates.RatesError, match="non couverte"):
        rates.fetch_policy_rate("XYZ")
    with pytest.raises(rates.RatesError):
        rates.carry_rate("EURUSD=X", flat_rates.drop(columns=["EUR"]))
