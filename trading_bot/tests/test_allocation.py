"""Gestion du risque : ce qu'elle ne peut pas faire, et ce qu'elle fait.

La première moitié de ce fichier démontre un théorème par simulation ; la
seconde vérifie la mécanique de l'allocation.
"""

from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from trading_bot import allocation as A


# --------------------------------------------------------------------------- #
# Ce que la gestion du risque ne peut PAS faire
# --------------------------------------------------------------------------- #
def _martingale_prices(n: int = 20_000, t: int = 250, sigma: float = 0.01,
                       seed: int = 42) -> np.ndarray:
    """Prix à espérance strictement constante : ``E[P_t] = P_0``.

    La dérive ``−σ²/2`` retire l'effet de Jensen ; sans elle, un prix
    log-normal monte en espérance et l'on croirait à tort avoir un edge.
    """
    rng = np.random.default_rng(seed)
    returns = rng.normal(-sigma * sigma / 2, sigma, (n, t))
    return np.concatenate(
        [np.full((n, 1), 100.0), 100 * np.exp(np.cumsum(returns, axis=1))], axis=1
    )


def test_the_market_used_for_these_proofs_is_truly_fair():
    prices = _martingale_prices()
    assert (prices[:, -1] / 100).mean() == pytest.approx(1.0, abs=0.005)


@pytest.mark.parametrize("stop,target", [(0.02, 0.02), (0.01, 0.05), (0.05, 0.01)])
def test_no_stop_target_combination_creates_expectancy(stop, target):
    """Théorème d'arrêt optionnel : sur un jeu équitable, **toute** règle d'arrêt
    laisse l'espérance inchangée.

    Le point contre-intuitif est dans la *médiane* : un stop large avec un
    objectif serré produit un taux de réussite élevé et une médiane positive,
    ce qui donne l'illusion d'un système gagnant. L'espérance, elle, ne bouge
    pas — les rares grosses pertes compensent exactement les gains fréquents.
    """
    prices = _martingale_prices()
    upper, lower = 100 * (1 + target), 100 * (1 - stop)

    touched = (prices >= upper) | (prices <= lower)
    exit_index = np.where(touched.any(axis=1), touched.argmax(axis=1), prices.shape[1] - 1)
    outcome = prices[np.arange(len(prices)), exit_index] / 100 - 1

    assert outcome.mean() == pytest.approx(0.0, abs=0.002)


def test_stop_target_changes_the_median_but_not_the_mean():
    """Deux réglages opposés : médianes très différentes, espérances identiques."""
    prices = _martingale_prices()

    def run(stop: float, target: float) -> np.ndarray:
        upper, lower = 100 * (1 + target), 100 * (1 - stop)
        touched = (prices >= upper) | (prices <= lower)
        idx = np.where(touched.any(axis=1), touched.argmax(axis=1), prices.shape[1] - 1)
        return prices[np.arange(len(prices)), idx] / 100 - 1

    frequent_wins = run(stop=0.05, target=0.01)   # gagne souvent, perd gros
    rare_wins = run(stop=0.01, target=0.05)       # perd souvent, gagne gros

    assert np.median(frequent_wins) > np.median(rare_wins)          # médianes opposées
    assert frequent_wins.mean() == pytest.approx(rare_wins.mean(), abs=0.003)
    assert frequent_wins.mean() == pytest.approx(0.0, abs=0.002)


def test_martingale_sizing_buys_a_good_median_with_ruin():
    """Le doublement après perte produit une médiane spectaculaire — et ruine
    une fraction massive des comptes. C'est exactement ce qui le rend séduisant.
    """
    rng = np.random.default_rng(7)
    n, t = 20_000, 250
    wins = rng.random((n, t)) < 0.5

    capital = np.full(n, 100.0)
    stake = np.ones(n)
    ruined = np.zeros(n, dtype=bool)

    for step in range(t):
        gain = np.where(wins[:, step], stake, -stake)
        gain[ruined] = 0.0
        capital += gain
        stake = np.where(wins[:, step], 1.0, np.minimum(stake * 2, 1e6))
        ruined |= capital <= 0
        capital[ruined] = 0.0
        stake[ruined] = 0.0

    assert np.median(capital) > 100.0        # la médiane flatte
    assert ruined.mean() > 0.2               # et pourtant : comptes détruits


# --------------------------------------------------------------------------- #
# Ce qu'elle fait réellement
# --------------------------------------------------------------------------- #
@pytest.fixture
def two_assets() -> pd.DataFrame:
    """Deux actifs à dérive positive, faiblement corrélés."""
    rng = np.random.default_rng(3)
    n = 2500
    index = pd.bdate_range("2010-01-01", periods=n)
    a = np.exp(np.cumsum(rng.normal(0.0004, 0.012, n)))
    b = np.exp(np.cumsum(rng.normal(0.0004, 0.006, n)))
    return pd.DataFrame({"VOLATILE": 100 * a, "CALME": 100 * b}, index=index)


def test_weights_never_depend_on_future_prices(two_assets):
    """Tronquer la série ne doit rien changer aux poids déjà détenus."""
    full = A.volatility_targeted(two_assets, cost_bps=0.0)
    partial = A.volatility_targeted(two_assets.iloc[:1500], cost_bps=0.0)

    common = partial.equity.index
    np.testing.assert_allclose(
        full.equity.loc[common].to_numpy(), partial.equity.to_numpy(), rtol=1e-9
    )


def test_risk_parity_gives_the_calm_asset_more_capital(two_assets):
    """Sans pondération par le risque, l'actif volatil dicterait toute la
    variance du portefeuille."""
    returns = two_assets.pct_change()
    vol = returns.rolling(60, min_periods=30).std().shift(1)
    inverse = (1.0 / vol).replace([np.inf, -np.inf], np.nan)
    weights = inverse.div(inverse.sum(axis=1), axis=0).dropna()

    assert (weights["CALME"] > weights["VOLATILE"]).mean() > 0.95


def test_weights_drift_between_rebalances(two_assets):
    """Entre deux rebalancements les poids **bougent**. Les reconduire à
    l'identique reviendrait à rebalancer tous les jours."""
    target = pd.DataFrame(0.5, index=two_assets.index, columns=two_assets.columns)
    held = A._drift_weights(target, two_assets.pct_change(), rebalance_days=21)

    assert held.iloc[0].tolist() == [0.5, 0.5]        # à la date de rebalancement
    assert held.iloc[5].tolist() != [0.5, 0.5]        # cinq jours plus tard : dérive
    np.testing.assert_allclose(held.iloc[21].to_numpy(), [0.5, 0.5])   # puis remise à plat


def test_rebalancing_more_often_costs_more(two_assets):
    rare = A.equal_weight_rebalanced(two_assets, cost_bps=5.0, rebalance_days=63)
    frequent = A.equal_weight_rebalanced(two_assets, cost_bps=5.0, rebalance_days=5)
    assert frequent.turnover > rare.turnover
    assert frequent.total_costs > rare.total_costs


def test_allocation_survives_execution_delay(two_assets):
    """Contrôle décisif : une stratégie qui ne prédit rien à l'échelle de la
    barre ne doit **pas** dépendre du print de clôture. C'est ce qui la
    distingue de la stratégie directionnelle invalidée."""
    table = A.lag_robustness(two_assets, cost_bps=2.0)
    assert table.attrs["stable"]
    assert table["sharpe"].min() > 0.7 * table.loc[1, "sharpe"]
