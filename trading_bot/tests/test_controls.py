"""Contrôles positif et négatif de bout en bout.

Ces deux tests valident le pipeline entier avec une série dont on connaît les
propriétés. Un pipeline financier n'a pas de vérité terrain sur données réelles :
la seule façon de savoir s'il fonctionne est de lui donner un problème dont on
connaît déjà la réponse.
"""

from __future__ import annotations

import pytest

from trading_bot import pipeline
from trading_bot.config import Config, DataConfig, LabelConfig, SplitConfig
from trading_bot.data import generate_synthetic


def _run(kind: str, **label_kwargs):
    prices = generate_synthetic(1500, seed=7)
    cfg = Config(
        data=DataConfig(provider="synthetic", outputsize=1500),
        label=LabelConfig(kind=kind, **label_kwargs),
        split=SplitConfig(n_splits=5, min_train_size=250),
    )
    dataset = pipeline.build_dataset(prices, cfg, include_slow=False)
    from trading_bot import evaluate, model

    baseline = model.rolling_baseline(dataset.y, cfg.label.horizon, cfg.split.baseline_window)
    predictions = model.walk_forward_predict(
        dataset.X, dataset.y, dataset.res_pos, cfg.split, cfg.model, baseline=baseline
    )
    return evaluate.evaluate(predictions)


def test_negative_control_direction_has_no_skill():
    """Les signes des rendements du générateur sont i.i.d. : il n'y a *rien* à
    trouver. Un skill positif ici signalerait une fuite de données — c'est le
    test qui garde le pipeline honnête."""
    report = _run("direction", horizon=1)
    assert report.auc == pytest.approx(0.5, abs=0.04)
    assert report.brier_skill < 0.005
    # Et surtout : ne pas prétendre savoir. La probabilité doit rester collée
    # à la baseline plutôt que d'inventer de la conviction.
    assert report.sharpness < 0.06


def test_positive_control_amplitude_has_skill():
    """La volatilité du générateur est groupée (GARCH) : l'amplitude *doit* être
    prédictible. Un skill nul ici signalerait un pipeline cassé."""
    report = _run("amplitude", horizon=5, barrier_pct=0.005)
    assert report.auc > 0.57
    assert report.brier_skill > 0
    assert report.logloss_skill > 0
    assert report.has_skill


def test_atr_threshold_destroys_the_signal_it_should_capture():
    """Documente le piège de définition d'événement le plus coûteux.

    Normaliser le seuil par la volatilité courante transforme « y aura-t-il un
    gros mouvement ? » en « la volatilité future dépassera-t-elle la volatilité
    récente ? » — un ratio quasi imprédictible. Le même pipeline, les mêmes
    features, un seuil différent : tout le signal disparaît.
    """
    pct = _run("amplitude", horizon=5, barrier_pct=0.005)
    atr = _run("amplitude", horizon=5, barrier_atr=2.0, threshold_mode="atr")
    assert pct.auc > atr.auc + 0.05
