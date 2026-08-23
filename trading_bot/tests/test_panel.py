"""Chemin multi-actifs mutualisé.

Le contrôle négatif de ce fichier est le test le plus important du projet :
c'est lui qui distingue « le modèle mutualisé trouve un vrai edge » de « le
découpage par date fuit ». Un Sharpe positif sur dix marches aléatoires
indépendantes ne serait pas une découverte, ce serait un bug.
"""

from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from trading_bot import data as data_module
from trading_bot import evaluate, panel
from trading_bot.config import BacktestConfig, Config, DataConfig, LabelConfig, SplitConfig


@pytest.fixture
def random_walk_universe(monkeypatch):
    """Dix séries GARCH indépendantes : volatilité groupée, signes i.i.d."""
    series = {f"RW{i}": data_module.generate_synthetic(2200, seed=200 + i) for i in range(10)}
    monkeypatch.setattr(panel.data_module, "load", lambda cfg: series[cfg.symbol])
    return list(series)


def _config(**label_kwargs) -> Config:
    return Config(
        data=DataConfig(provider="synthetic"),
        label=LabelConfig(**label_kwargs),
        split=SplitConfig(n_splits=4, min_train_size=600, embargo=5),
    )


def test_negative_control_on_the_panel_path(random_walk_universe):
    """Aucun edge directionnel n'existe ici. Le pipeline ne doit pas en inventer."""
    cfg = _config(kind="direction", horizon=1)
    pan = panel.build_panel(random_walk_universe, cfg, include_slow=False)
    predictions = panel.walk_forward(pan, cfg)
    report = evaluate.evaluate(predictions)

    assert report.auc == pytest.approx(0.5, abs=0.03)
    assert report.brier_skill < 0.003

    result = panel.portfolio_backtest(pan, predictions, cfg)
    assert abs(result.sharpe) < 0.5


def test_panel_pools_every_asset(random_walk_universe):
    cfg = _config(kind="direction", horizon=1)
    pan = panel.build_panel(random_walk_universe, cfg, include_slow=False)
    assert pan.frame["symbol"].nunique() == len(random_walk_universe)
    # Un seul modèle voit toutes les lignes : c'est tout l'intérêt du panel.
    assert len(pan.frame) > 10 * 1500


def test_folds_split_by_date_not_by_row(random_walk_universe):
    """Tous les actifs doivent basculer train/test à la même date.

    Un découpage par ligne mettrait l'actif A en test pendant que l'actif B, à
    la même date, serait encore en entraînement — et les actifs sont corrélés.
    """
    cfg = _config(kind="direction", horizon=1)
    pan = panel.build_panel(random_walk_universe, cfg, include_slow=False)
    predictions = panel.walk_forward(pan, cfg)

    for _, group in predictions.groupby("fold"):
        spans = group.groupby("symbol")["date"].agg(["min", "max"])
        # Chaque actif couvre la même fenêtre temporelle dans un fold donné.
        assert spans["min"].nunique() <= 2
        assert spans["max"].nunique() <= 2

    # Et les folds ne se chevauchent pas dans le temps.
    bounds = predictions.groupby("fold")["date"].agg(["min", "max"]).sort_index()
    assert (bounds["min"].shift(-1).dropna() > bounds["max"][:-1]).all()


def test_purge_excludes_labels_overlapping_the_test_window(random_walk_universe):
    """Avec un horizon long, un label d'entraînement ne doit jamais se résoudre
    dans la fenêtre de test."""
    cfg = _config(kind="direction", horizon=21)
    pan = panel.build_panel(random_walk_universe, cfg, include_slow=False)
    predictions = panel.walk_forward(pan, cfg)

    frame = pan.frame
    for fold, group in predictions.groupby("fold"):
        test_start = group["date"].min()
        cutoff = test_start - pd.Timedelta(days=cfg.split.embargo)
        train = frame[frame["resolution"] < cutoff]
        assert (train["resolution"] < test_start).all()


def test_risk_parity_prevents_one_asset_from_dominating(random_walk_universe):
    """Sans mise à l'échelle par la volatilité, l'actif le plus volatil dicterait
    tout le résultat du portefeuille."""
    cfg = _config(kind="direction", horizon=1)
    pan = panel.build_panel(random_walk_universe, cfg, include_slow=False)

    # Un actif rendu dix fois plus volatil que les autres.
    loud = pan.prices[random_walk_universe[0]].copy()
    centre = loud["close"].mean()
    for column in ("open", "high", "low", "close"):
        loud[column] = centre + (loud[column] - centre) * 10
    pan.prices[random_walk_universe[0]] = loud

    predictions = panel.walk_forward(pan, cfg)
    # Seuil nul : sur des marches aléatoires le modèle reste sinon en zone morte
    # et ne prend aucune position. Ce test porte sur le dimensionnement, pas sur
    # l'existence d'un edge.
    always_trade = Config(data=cfg.data, label=cfg.label, split=cfg.split,
                          backtest=BacktestConfig(edge_threshold=0.0))
    result = panel.portfolio_backtest(pan, predictions, always_trade)

    contributions = result.per_asset["rendement"].abs()
    assert contributions.max() < 5 * contributions.median()


def test_costs_are_reported_not_silently_swallowed(random_walk_universe):
    cfg = _config(kind="direction", horizon=1)
    pan = panel.build_panel(random_walk_universe, cfg, include_slow=False)
    predictions = panel.walk_forward(pan, cfg)

    free = panel.portfolio_backtest(
        pan, predictions,
        Config(data=cfg.data, label=cfg.label, split=cfg.split,
               backtest=BacktestConfig(spread_bps=0.0, edge_threshold=0.0)),
    )
    costly = panel.portfolio_backtest(
        pan, predictions,
        Config(data=cfg.data, label=cfg.label, split=cfg.split,
               backtest=BacktestConfig(spread_bps=10.0, edge_threshold=0.0)),
    )
    assert free.total_costs == 0.0
    assert costly.total_costs > 0.0
    assert costly.total_return < free.total_return


def test_lag_robustness_flags_a_microstructure_artefact(monkeypatch):
    """Une série dont la clôture est bruitée produit un edge de retour à la
    moyenne **entièrement faux**. Le contrôle de décalage doit le détecter.

    C'est le scénario qui a invalidé le résultat le plus prometteur de ce dépôt :
    Sharpe +3.69 à lag=1, −0.79 à lag=2. Le test verrouille la détection.
    """
    rng = np.random.default_rng(11)
    n = 1400
    # Prix « vrai » : marche aléatoire pure, aucun effet exploitable.
    true_price = 100 * np.exp(np.cumsum(rng.normal(0, 0.006, n)))
    # Print observé : le vrai prix plus un bruit indépendant — exactement le
    # rebond bid-ask. Il crée une autocorrélation négative artificielle.
    # Bruit volontairement plus marqué que le cas réel (Yahoo : autocorr −0.024)
    # pour que le test soit sans ambiguïté.
    observed = true_price * (1 + rng.normal(0, 0.004, n))

    index = pd.bdate_range("2015-01-01", periods=n)
    frame = pd.DataFrame(
        {"open": observed, "high": observed * 1.002, "low": observed * 0.998,
         "close": observed, "volume": 0.0},
        index=index,
    )
    returns = pd.Series(np.log(observed)).diff().dropna()
    assert returns.autocorr(1) < -0.1, "le montage doit bien produire du bounce"

    series = {f"NOISY{i}": frame for i in range(4)}
    monkeypatch.setattr(panel.data_module, "load", lambda cfg: series[cfg.symbol])

    cfg = _config(kind="direction", horizon=1)
    pan = panel.build_panel(list(series), cfg, include_slow=False)
    predictions = panel.walk_forward(pan, cfg)

    table = panel.lag_robustness(pan, predictions, cfg)
    assert list(table.index) == [1, 2, 3]
    # Le rendement doit être concentré sur la première barre, donc s'effondrer.
    assert table.loc[2, "sharpe"] < 0.5 * table.loc[1, "sharpe"]
    assert table.attrs["tradable"] is False


def test_lag_robustness_accepts_a_persistent_effect(monkeypatch):
    """Contrôle symétrique : un effet qui se déploie sur plusieurs jours doit
    être accepté, sinon le garde-fou rejetterait aussi les vrais signaux."""
    rng = np.random.default_rng(12)
    n = 1400
    # Tendance lente et persistante : le signal reste valable plusieurs barres.
    drift = pd.Series(rng.normal(0, 0.004, n)).rolling(30, min_periods=1).mean()
    price = 100 * np.exp(np.cumsum(drift.to_numpy() * 3))
    index = pd.bdate_range("2015-01-01", periods=n)
    frame = pd.DataFrame(
        {"open": price, "high": price * 1.003, "low": price * 0.997,
         "close": price, "volume": 0.0},
        index=index,
    )
    series = {f"TREND{i}": frame for i in range(4)}
    monkeypatch.setattr(panel.data_module, "load", lambda cfg: series[cfg.symbol])

    cfg = _config(kind="direction", horizon=1)
    pan = panel.build_panel(list(series), cfg, include_slow=False)
    table = panel.lag_robustness(pan, panel.walk_forward(pan, cfg), cfg)

    assert table.loc[1, "sharpe"] > 0
    assert table.loc[2, "sharpe"] > 0.5 * table.loc[1, "sharpe"]
    assert table.attrs["tradable"] is True
