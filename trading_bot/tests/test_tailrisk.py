"""Labels de queue : symétrie de construction et causalité."""

from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from trading_bot import tailrisk as T


@pytest.fixture
def flat_market() -> pd.DataFrame:
    """Prix immobile à 100, sur lequel on injecte des chocs contrôlés."""
    index = pd.bdate_range("2020-01-01", periods=60)
    close = pd.Series(100.0, index=index)
    return pd.DataFrame({"open": close, "high": close, "low": close, "close": close})


def test_down_label_fires_on_an_intrabar_low(flat_market):
    """Une baisse touchée en séance compte, même si la clôture se referme —
    un stop l'aurait déclenchée."""
    frame = flat_market.copy()
    frame.loc[frame.index[15], "low"] = 94.0        # −6 % touché, clôture inchangée

    down, up, _ = T.tail_labels(frame, horizon=10, threshold=0.05)
    assert down.iloc[10] == 1.0        # la fenêtre (10, 20] contient la barre 15
    assert down.iloc[14] == 1.0
    assert down.iloc[15] == 0.0        # la barre elle-même est exclue de sa fenêtre
    assert up.iloc[10] == 0.0


def test_labels_are_exact_mirrors(flat_market):
    """Toute asymétrie mesurée doit venir du marché, pas de la définition."""
    frame = flat_market.copy()
    frame.loc[frame.index[20], "low"] = 94.0
    frame.loc[frame.index[40], "high"] = 106.0

    down, up, _ = T.tail_labels(frame, horizon=10, threshold=0.05)
    assert down.iloc[15] == 1.0 and up.iloc[15] == 0.0
    assert up.iloc[35] == 1.0 and down.iloc[35] == 0.0
    # Mêmes lignes observables des deux côtés.
    assert (down.notna() == up.notna()).all()


def test_both_label_requires_two_sided_moves(flat_market):
    frame = flat_market.copy()
    frame.loc[frame.index[12], "low"] = 94.0
    frame.loc[frame.index[14], "high"] = 106.0

    down, up, both = T.tail_labels(frame, horizon=10, threshold=0.05)
    assert both.iloc[10] == 1.0                     # les deux dans la fenêtre
    assert both.iloc[13] == 0.0                     # seule la hausse reste devant
    # Comparaison sur les seules lignes observables : NaN <= 0 vaut False et
    # masquerait la propriété qu'on veut vérifier.
    seen = both.notna()
    assert (both[seen] <= down[seen]).all() and (both[seen] <= up[seen]).all()
    assert (both.isna() == down.isna()).all()


@pytest.mark.parametrize("horizon", [5, 10, 21])
def test_unobservable_windows_are_nan(flat_market, horizon):
    """Les dernières barres n'ont pas de futur complet : absentes, jamais 0."""
    down, up, _ = T.tail_labels(flat_market, horizon=horizon, threshold=0.05)
    assert down.iloc[-horizon:].isna().all()
    assert up.iloc[-horizon:].isna().all()
    assert down.iloc[: -horizon].notna().all()


def test_labels_do_not_depend_on_data_beyond_their_window():
    """Tronquer bien après la fenêtre ne doit rien changer aux labels calculés."""
    rng = np.random.default_rng(3)
    n = 400
    close = pd.Series(100 * np.exp(np.cumsum(rng.normal(0, 0.012, n))),
                      index=pd.bdate_range("2020-01-01", periods=n))
    frame = pd.DataFrame({"open": close, "high": close * 1.004,
                          "low": close * 0.996, "close": close})

    full, _, _ = T.tail_labels(frame, horizon=10, threshold=0.05)
    partial, _, _ = T.tail_labels(frame.iloc[:300], horizon=10, threshold=0.05)
    common = partial.dropna().index
    pd.testing.assert_series_equal(full.loc[common], partial.loc[common])


def test_higher_threshold_is_strictly_rarer():
    rng = np.random.default_rng(4)
    n = 3000
    close = pd.Series(100 * np.exp(np.cumsum(rng.normal(0, 0.011, n))),
                      index=pd.bdate_range("2015-01-01", periods=n))
    frame = pd.DataFrame({"open": close, "high": close * 1.006,
                          "low": close * 0.994, "close": close})

    rates = [T.tail_labels(frame, 10, th)[0].mean() for th in (0.03, 0.05, 0.08)]
    assert rates[0] > rates[1] > rates[2]


def test_report_calls_symmetry_when_aucs_match():
    balanced = T.asymmetry_report({"auc": 0.70, "skill": 0.05, "base": 0.11},
                                  {"auc": 0.695, "skill": 0.04, "base": 0.08})
    assert "Symétrique" in balanced
    assert "rien de neuf" in balanced

    skewed = T.asymmetry_report({"auc": 0.74, "skill": 0.08, "base": 0.11},
                                {"auc": 0.66, "skill": 0.03, "base": 0.08})
    assert "BAISSE est plus prédictible" in skewed
