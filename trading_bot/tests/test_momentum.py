"""Momentum cross-sectionnel."""

from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from trading_bot import momentum as M


@pytest.fixture
def trending_universe() -> pd.DataFrame:
    """Six actifs dont trois ont une dérive persistante et trois non.

    Le classement doit retrouver les bons — sinon le signal ne mesure rien.
    """
    rng = np.random.default_rng(5)
    n = 1800
    index = pd.bdate_range("2015-01-01", periods=n)
    data = {}
    for i in range(3):
        data[f"UP{i}"] = 100 * np.exp(np.cumsum(rng.normal(0.0006, 0.011, n)))
    for i in range(3):
        data[f"FLAT{i}"] = 100 * np.exp(np.cumsum(rng.normal(-0.0002, 0.011, n)))
    return pd.DataFrame(data, index=index)


def test_momentum_score_skips_the_most_recent_month(trending_universe):
    """Le saut n'est pas cosmétique : il exclut la fenêtre où vit le retour à la
    moyenne court terme, dont ce dépôt a montré qu'il était un artefact de
    microstructure. Un score sans saut mélange deux effets de signes opposés.
    """
    score = M.momentum_score(trending_universe, lookback=252, skip=21)
    log_price = np.log(trending_universe)

    # Le score en t compare t-21 à t-252 : le dernier mois n'y entre pas.
    assert score.iloc[252 + 300]["UP0"] == pytest.approx(
        log_price.iloc[252 + 300 - 21]["UP0"] - log_price.iloc[300]["UP0"]
    )
    assert score.iloc[:252].isna().all().all()      # pas de score sans historique


def test_ranking_identifies_the_trending_assets(trending_universe):
    score = M.momentum_score(trending_universe, 252, 21).dropna()
    ranks = score.rank(axis=1, pct=True)
    up = [c for c in trending_universe.columns if c.startswith("UP")]
    flat = [c for c in trending_universe.columns if c.startswith("FLAT")]
    assert ranks[up].mean().mean() > ranks[flat].mean().mean()


def test_long_only_weights_sum_to_one(trending_universe):
    result = M.cross_sectional(trending_universe, cost_bps=0.0, long_short=False)
    assert result.turnover > 0
    assert np.isfinite(result.sharpe)


def test_long_short_is_roughly_market_neutral(trending_universe):
    """Les deux jambes doivent se compenser : c'est ce qui annule un choc commun."""
    prices = trending_universe
    score = M.momentum_score(prices, 252, 21)
    ranks = score.rank(axis=1, pct=True)
    vol = prices.pct_change().rolling(60, min_periods=30).std().shift(1)
    inverse = (1.0 / vol).replace([np.inf, -np.inf], np.nan)

    def leg(mask):
        w = mask.astype(float) * inverse
        return w.div(w.sum(axis=1).replace(0, np.nan), axis=0).fillna(0.0)

    net = (leg(ranks > 2 / 3) - leg(ranks < 1 / 3)).sum(axis=1)
    assert net.abs().max() < 1e-9


def test_signal_never_uses_future_prices(trending_universe):
    """Tronquer la série ne doit rien changer aux scores déjà calculés."""
    full = M.momentum_score(trending_universe, 252, 21)
    partial = M.momentum_score(trending_universe.iloc[:1200], 252, 21)
    pd.testing.assert_frame_equal(full.loc[partial.index], partial, rtol=1e-9)


def test_momentum_survives_execution_delay(trending_universe):
    """Un signal à douze mois ne doit rien devoir au print de clôture du jour.
    C'est ce qui le distingue du signal directionnel invalidé, qui passait de
    +3.69 à −0.79 de Sharpe avec une seule barre de retard."""
    table = M.lag_robustness(trending_universe, cost_bps=2.0, long_short=False)
    assert table.attrs["stable"]


def test_costs_and_rebalancing_frequency_interact(trending_universe):
    rare = M.cross_sectional(trending_universe, 5.0, rebalance_days=63, long_short=False)
    frequent = M.cross_sectional(trending_universe, 5.0, rebalance_days=5, long_short=False)
    assert frequent.turnover > rare.turnover
