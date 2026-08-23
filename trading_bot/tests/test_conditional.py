"""Recherche d'edge conditionnel : les diagnostics doivent trancher correctement."""

from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from trading_bot import conditional as K


def _frame(first_day: np.ndarray, later: np.ndarray, n: int,
           seed: int = 0) -> pd.DataFrame:
    """Construit un jeu de prédictions au signal contrôlé."""
    rng = np.random.default_rng(seed)
    p = rng.uniform(0.4, 0.6, n)
    baseline = np.full(n, 0.5)
    direction = np.sign(p - baseline)
    return pd.DataFrame({
        "p": p, "baseline": baseline, "y": (rng.random(n) < 0.5).astype(float),
        "f1": direction * first_day, "f2": direction * later,
        "f3": direction * later, "f5": direction * later,
    })


def test_volatility_state_is_causal():
    """Tronquer la série ne doit rien changer aux états déjà calculés."""
    rng = np.random.default_rng(1)
    prices = pd.Series(100 * np.exp(np.cumsum(rng.normal(0, 0.01, 2000))),
                       index=pd.bdate_range("2015-01-01", periods=2000))
    full = K.volatility_state(prices)
    partial = K.volatility_state(prices.iloc[:1400])
    pd.testing.assert_series_equal(full.loc[partial.index], partial, rtol=1e-9)


def test_state_is_bounded_and_shifted():
    rng = np.random.default_rng(2)
    prices = pd.Series(100 * np.exp(np.cumsum(rng.normal(0, 0.01, 1500))),
                       index=pd.bdate_range("2015-01-01", periods=1500))
    state = K.volatility_state(prices).dropna()
    assert state.between(0, 1).all()
    assert len(state) < len(prices)          # les premières barres sont indéfinies


def test_microstructure_artefact_is_rejected():
    """Tout le gain sur la première barre, rien ensuite : c'est du bruit de
    cotation. C'est le profil qui a invalidé le Sharpe 3.69 de ce dépôt."""
    n = 4000
    rng = np.random.default_rng(3)
    frame = _frame(first_day=np.full(n, 0.002) + rng.normal(0, 0.001, n),
                   later=rng.normal(0, 0.01, n), n=n, seed=3)
    d = K.diagnose(frame, "artefact")
    assert d.decay[1] > 0
    assert not d.survives_delay
    assert "artefact" in d.verdict()


def test_persistent_dislocation_is_accepted():
    """Le gain se reproduit les jours suivants : dislocation économique."""
    n = 4000
    rng = np.random.default_rng(4)
    frame = _frame(first_day=np.full(n, 0.002) + rng.normal(0, 0.001, n),
                   later=np.full(n, 0.0018) + rng.normal(0, 0.001, n), n=n, seed=4)
    d = K.diagnose(frame, "dislocation")
    assert d.survives_delay
    assert abs(d.tstat) > 2
    assert d.verdict() == "survit au décalage ET significatif"


def test_concentration_is_flagged():
    """Un gain porté par une poignée d'observations n'est pas un edge, même si
    sa moyenne est positive."""
    n = 4000
    payoff = np.full(n, 0.00005)
    payoff[:20] = 2.0                     # 0,5 % des observations portent tout
    # ``diagnose`` applique lui-même le signe de la position : on passe donc le
    # rendement brut, pas déjà signé.
    frame = _frame(first_day=payoff, later=payoff, n=n, seed=5)
    frame["p"] = 0.6                      # position constamment longue
    frame["f1"] = payoff
    frame["f2"] = payoff
    d = K.diagnose(frame, "loterie")
    assert d.is_concentrated
    assert d.top_1pct_share > 0.5


def test_concentration_is_undefined_without_a_gain():
    """Régression : avec un total négatif, la part du top 1 % sortait à −4,5.
    La question « d'où vient le gain ? » ne se pose pas s'il n'y en a pas."""
    n = 2000
    frame = _frame(first_day=np.full(n, 0.001), later=np.full(n, 0.001), n=n, seed=8)
    frame["p"] = 0.6
    frame["f1"] = np.full(n, -0.001)      # perte systématique
    frame["f2"] = np.full(n, -0.001)
    d = K.diagnose(frame, "perte")
    assert np.isnan(d.top_1pct_share)
    assert not d.is_concentrated
    assert d.verdict() == "pas de gain"


def test_no_gain_is_reported_plainly():
    n = 3000
    rng = np.random.default_rng(6)
    frame = _frame(first_day=rng.normal(-0.0005, 0.01, n),
                   later=rng.normal(0, 0.01, n), n=n, seed=6)
    frame["f1"] = -np.abs(rng.normal(0.001, 0.0005, n))
    d = K.diagnose(frame, "rien")
    assert d.verdict() == "pas de gain"


def test_report_mentions_multiple_testing():
    n = 2000
    rng = np.random.default_rng(7)
    diagnostics = [K.diagnose(_frame(rng.normal(0, 0.01, n), rng.normal(0, 0.01, n),
                                     n, seed=i), f"r{i}") for i in range(3)]
    text = K.report(diagnostics)
    assert "tests multiples" in text
    assert "3 régimes testés" in text
