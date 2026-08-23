"""Tests anti-fuite.

Ce sont les tests qui comptent. Un pipeline financier qui fuit produit des
métriques flatteuses et perd de l'argent en production ; aucune revue de code
ne rattrape ça de façon fiable, seule une vérification mécanique le fait.
"""

from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from trading_bot import features, labels, model, pipeline
from trading_bot.config import Config, LabelConfig, ModelConfig, SplitConfig
from trading_bot.data import generate_synthetic


@pytest.fixture(scope="module")
def prices() -> pd.DataFrame:
    return generate_synthetic(600, seed=3)


def test_features_do_not_depend_on_the_future(prices):
    """Tronquer la série ne doit rien changer aux features déjà calculées.

    C'est la définition opérationnelle de la causalité : si une feature en t
    change quand on ajoute des barres après t, elle contient du futur.
    """
    full = features.build(prices, include_slow=False)
    truncated = features.build(prices.iloc[:400], include_slow=False)
    common = truncated.index

    pd.testing.assert_frame_equal(
        full.loc[common], truncated, check_exact=False, rtol=1e-9,
    )


def test_rolling_rank_is_causal(prices):
    full = features.rolling_rank(features.build(prices, include_slow=False), window=100)
    part = features.rolling_rank(features.build(prices.iloc[:400], include_slow=False), window=100)
    pd.testing.assert_frame_equal(full.loc[part.index], part, check_exact=False, rtol=1e-9)


@pytest.mark.parametrize("horizon", [1, 3, 5])
def test_direction_label_is_nan_when_future_is_unobserved(prices, horizon):
    """La faute du bot d'origine : ``NaN > x`` vaut ``False``, donc les dernières
    barres étaient étiquetées 0 au lieu d'être absentes."""
    y, _ = labels.direction(prices, horizon)
    assert y.iloc[-horizon:].isna().all()
    assert y.iloc[: -horizon].notna().all()


def test_amplitude_label_uses_only_the_future_window(prices):
    cfg = LabelConfig(kind="amplitude", horizon=3, barrier_pct=0.004)
    y, _ = labels.amplitude(prices, cfg)
    # Recalcul indépendant, barre par barre.
    close = prices["close"].to_numpy()
    high, low = prices["high"].to_numpy(), prices["low"].to_numpy()
    for t in (50, 120, 300):
        window_high = high[t + 1 : t + 4].max()
        window_low = low[t + 1 : t + 4].min()
        excursion = max(abs(window_high - close[t]), abs(window_low - close[t]))
        assert y.iloc[t] == float(excursion > 0.004 * close[t])


def test_triple_barrier_matches_a_hand_built_case():
    idx = pd.bdate_range("2020-01-01", periods=40)
    close = pd.Series(np.full(40, 100.0), index=idx)
    frame = pd.DataFrame(
        {"open": close, "high": close, "low": close, "close": close, "volume": 0.0}
    )
    # ATR constant = 1.0 grâce à un range fixe.
    frame["high"] = close + 0.5
    frame["low"] = close - 0.5
    # La barre 20 casse vers le haut, la barre 25 vers le bas.
    frame.loc[idx[20], "high"] = 110.0
    frame.loc[idx[25], "low"] = 90.0

    cfg = LabelConfig(kind="triple_barrier", horizon=10, barrier_atr=2.0, atr_window=5)
    y, resolution = labels.triple_barrier(frame, cfg)

    assert y.iloc[15] == 1.0                      # touche le haut en 20, avant le bas
    assert resolution.iloc[15] == idx[20]         # résolu à la barre 20, pas à 15+10
    assert y.iloc[22] == 0.0                      # depuis 22, seul le bas est touché


def test_labels_never_resolve_before_their_own_bar(prices):
    for cfg in (
        LabelConfig(kind="direction", horizon=2),
        LabelConfig(kind="amplitude", horizon=4),
        LabelConfig(kind="triple_barrier", horizon=6),
    ):
        _, resolution = labels.build(prices, cfg)
        res_pos = model.resolution_positions(prices.index, resolution)
        observed = res_pos >= 0
        assert (res_pos[observed] > np.flatnonzero(observed)).all()


def test_purge_removes_every_overlapping_training_sample():
    """Aucun échantillon d'entraînement ne doit se résoudre après le début du test."""
    n, horizon = 800, 7
    res_pos = np.arange(n) + horizon
    cfg = SplitConfig(n_splits=4, embargo=3, min_train_size=200)

    for fold in model.purged_walk_forward(n, res_pos, cfg):
        test_start = fold.test[0]
        train = np.concatenate([fold.train, fold.calibration])
        assert res_pos[train].max() < test_start - cfg.embargo
        assert train.max() < fold.test.min()          # ordre chronologique strict
        assert fold.purged >= horizon                 # la purge a bien mordu


def test_calibration_slice_sits_between_train_and_test():
    cfg = SplitConfig(n_splits=3, embargo=2, min_train_size=200)
    res_pos = np.arange(700) + 1
    for fold in model.purged_walk_forward(700, res_pos, cfg):
        assert fold.train.max() < fold.calibration.min()
        assert fold.calibration.max() < fold.test.min()


def test_base_rate_is_preserved(prices):
    """Aucun rééchantillonnage : la fréquence des classes doit rester intacte.

    SMOTE forçait le taux de base à 50/50, ce qui rend toute sortie
    inexploitable comme probabilité.
    """
    cfg = Config(label=LabelConfig(kind="direction", horizon=1))
    dataset = pipeline.build_dataset(prices, cfg, include_slow=False)
    y_full, _ = labels.direction(prices, 1)
    observed = y_full.loc[dataset.y.index]
    assert dataset.y.mean() == pytest.approx(observed.mean())
    assert 0.3 < float(dataset.y.mean()) < 0.7   # pas de rééquilibrage artificiel


def test_rolling_baseline_uses_only_resolved_labels():
    y = pd.Series([0.0] * 50 + [1.0] * 50)
    baseline = model.rolling_baseline(y, horizon=5, window=20)
    # Au moment de la bascule, la baseline ne peut pas encore la voir : les
    # labels de la zone 50+ ne sont connus qu'à partir de 55.
    assert baseline.iloc[50] == pytest.approx(0.0)
    assert baseline.iloc[-1] > 0.9
