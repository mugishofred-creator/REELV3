"""Stratégie intégrée : chaque couche à sa place, et rien de plus."""

from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from trading_bot import combined as X


@pytest.fixture
def universe() -> pd.DataFrame:
    """Six actifs de volatilités très différentes, avec des tendances distinctes."""
    rng = np.random.default_rng(11)
    n = 2200
    index = pd.bdate_range("2014-01-01", periods=n)
    data = {}
    for i, (drift, vol) in enumerate([(0.0006, 0.020), (0.0005, 0.016), (0.0004, 0.011),
                                      (0.0002, 0.008), (0.0001, 0.005), (-0.0001, 0.014)]):
        data[f"A{i}"] = 100 * np.exp(np.cumsum(rng.normal(drift, vol, n)))
    return pd.DataFrame(data, index=index)


def test_risk_parity_favours_the_calm_assets(universe):
    """Sans pondération par le risque, l'actif le plus volatil dicte la variance."""
    weights = X.build_weights(universe, X.Layer(False, True, False, False))
    late = weights.iloc[-1]
    assert late["A4"] > late["A0"]          # A4 est le moins volatil, A0 le plus


def test_equal_weight_layer_ignores_volatility(universe):
    """Vérifié à une DATE DE REBALANCEMENT : entre deux, les poids dérivent
    avec les rendements, et c'est voulu."""
    weights = X.build_weights(universe, X.Layer(False, False, False, False),
                              rebalance_days=21)
    np.testing.assert_allclose(weights.iloc[0].to_numpy(), np.full(6, 1 / 6), atol=1e-9)
    np.testing.assert_allclose(weights.iloc[21].to_numpy(), np.full(6, 1 / 6), atol=1e-9)
    assert not np.allclose(weights.iloc[10].to_numpy(), 1 / 6)      # dérive entre-temps


def test_selection_drops_the_bottom_of_the_ranking(universe):
    """La sélection écarte le bas du classement momentum, pas le haut."""
    weights = X.build_weights(universe, X.Layer(True, True, True, False), keep=0.5)
    held = (weights.iloc[-1] > 0).sum()
    assert held <= 3                        # au plus la moitié de six actifs
    assert held >= 1


def test_selection_falls_back_to_the_full_universe_before_any_score(universe):
    """Tant qu'aucun score momentum n'existe, on reste investi plutôt que vide."""
    weights = X.build_weights(universe, X.Layer(True, True, True, False))
    early = weights.iloc[100]
    assert early.sum() > 0


def test_vol_targeting_standardises_rather_than_reduces(universe):
    """Point important, et contre-intuitif : le ciblage de volatilité **n'est pas**
    une réduction du risque, c'est une standardisation.

    Sur des actifs dont la volatilité est inférieure à la cible, il ajoute du
    levier et **creuse** le drawdown. Sur données réelles il le réduisait
    (−24,8 % contre −36,4 %) parce que les actifs y étaient plus volatils que la
    cible — c'est une propriété des données, pas de la méthode.
    """
    without = X.run(universe, X.Layer(False, True, False, False), cost_bps=0.0)
    with_target = X.run(universe, X.Layer(False, True, True, False), cost_bps=0.0,
                        target_vol=0.10)
    # La volatilité réalisée se rapproche de la cible, dans un sens ou l'autre.
    assert abs(with_target.volatility - 0.10) < abs(without.volatility - 0.10)


def test_weights_never_use_future_prices(universe):
    """Tronquer la série ne doit rien changer aux poids déjà détenus."""
    full = X.build_weights(universe, X.Layer(True, True, True, False))
    partial = X.build_weights(universe.iloc[:1600], X.Layer(True, True, True, False))
    common = partial.index
    pd.testing.assert_frame_equal(full.loc[common], partial, rtol=1e-9)


def test_tilt_is_bounded_and_never_decides_alone(universe):
    """L'inclinaison module, elle ne peut pas concentrer le portefeuille.

    Le signal d'asymétrie est le plus faible du projet (t = 2.12, non établi) :
    il n'a pas le droit de dicter l'exposition.
    """
    rng = np.random.default_rng(12)
    tilt = pd.DataFrame(rng.normal(0, 1, universe.shape),
                        index=universe.index, columns=universe.columns)

    plain = X.build_weights(universe, X.Layer(False, True, False, False))
    tilted = X.build_weights(universe, X.Layer(False, True, False, True),
                             tilt=tilt, tilt_strength=0.3)

    late_plain, late_tilted = plain.iloc[-1], tilted.iloc[-1]
    assert (late_tilted >= 0).all()                      # jamais de poids négatif
    # Chaque poids reste dans un voisinage du poids non incliné.
    ratio = (late_tilted / late_plain.replace(0, np.nan)).dropna()
    assert ratio.max() < 2.0 and ratio.min() > 0.4


def test_ablation_reports_every_layer(universe):
    table = X.ablation(universe, cost_bps=2.0)
    assert len(table) == 4
    assert "référence équipondérée" in table.index
    assert (table["turnover/an"] > 0).all()


def test_ablation_includes_the_tilt_only_when_supplied(universe):
    rng = np.random.default_rng(13)
    tilt = pd.DataFrame(rng.normal(0, 1, universe.shape),
                        index=universe.index, columns=universe.columns)
    assert len(X.ablation(universe, 2.0, tilt=tilt)) == 5


def test_layer_label_describes_what_is_active():
    assert X.Layer(False, False, False, False).label() == "tout l'univers + équipondéré"
    full = X.Layer(True, True, True, True).label()
    assert all(part in full for part in
               ("sélection", "parité de risque", "vol ciblée", "inclinaison"))
