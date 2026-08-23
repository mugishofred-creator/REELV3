"""Assemblage : données → features → labels → probabilités → évaluation."""

from __future__ import annotations

import logging
from dataclasses import dataclass

import numpy as np
import pandas as pd

from . import backtest, data, evaluate, features, labels, model
from .config import Config

logger = logging.getLogger(__name__)

#: Événements pour lesquels un backtest directionnel a un sens. « amplitude »
#: prédit qu'un mouvement aura lieu, pas son sens : en tirer une position longue
#: serait un contresens.
DIRECTIONAL_EVENTS = {"direction", "triple_barrier"}


@dataclass
class Dataset:
    X: pd.DataFrame
    y: pd.Series
    res_pos: np.ndarray
    prices: pd.DataFrame


def build_dataset(prices: pd.DataFrame, cfg: Config, include_slow: bool = True) -> Dataset:
    """Aligne features et labels, et retire les lignes inexploitables.

    Un point technique qui a son importance : les positions de résolution des
    labels sont recalculées dans l'espace *filtré*. Sans ce remappage, la purge
    comparerait des positions issues de deux référentiels différents et
    laisserait passer du recouvrement.
    """
    X_full = features.build(prices, include_slow=include_slow)
    if cfg.model.feature_transform == "rank":
        X_full = features.rolling_rank(X_full, cfg.model.rank_window)
    y_full, resolution = labels.build(prices, cfg.label)
    res_pos_full = model.resolution_positions(prices.index, resolution)

    usable = y_full.notna().to_numpy() & X_full.notna().all(axis=1).to_numpy() & (res_pos_full >= 0)
    kept = np.flatnonzero(usable)
    if len(kept) == 0:
        raise ValueError("Aucune ligne exploitable : historique trop court pour ces fenêtres.")

    # Remappage conservateur : première position conservée >= la résolution réelle.
    res_pos = np.searchsorted(kept, res_pos_full[kept], side="left")

    logger.info(
        "Dataset : %d lignes utilisables sur %d, %d features, taux de base %.4f",
        len(kept), len(prices), X_full.shape[1], float(y_full.iloc[kept].mean()),
    )
    return Dataset(
        X=X_full.iloc[kept],
        y=y_full.iloc[kept],
        res_pos=res_pos,
        prices=prices,
    )


@dataclass
class Result:
    config: Config
    event: str
    dataset: Dataset
    predictions: pd.DataFrame
    report: evaluate.Report
    backtest: backtest.BacktestResult | None

    def to_text(self) -> str:
        blocks = [
            "=" * 72,
            f"ÉVÉNEMENT   : {self.event}",
            f"SYMBOLE     : {self.config.data.symbol} ({self.config.data.provider})",
            f"MODÈLE      : {self.config.model.name}, calibration={self.config.model.calibration}",
            "=" * 72,
            "",
            "--- QUALITÉ DE LA PROBABILITÉ " + "-" * 42,
            self.report.to_text(),
        ]
        if self.backtest is not None:
            blocks += ["", "--- BACKTEST HORS-ÉCHANTILLON " + "-" * 42, self.backtest.to_text()]
            if not self.report.has_skill:
                # Sans skill, la ligne « bat le buy & hold » ne veut rien dire :
                # une stratégie exposée 7 % du temps bat mécaniquement un actif
                # qui baisse, sans avoir rien prédit du tout. Le juge de paix
                # reste la section précédente, jamais le P&L.
                blocks += [
                    "",
                    "ATTENTION : la probabilité n'a pas de skill. Les chiffres de "
                    "backtest ci-dessus sont",
                    "du bruit — une exposition faible suffit à « battre » un actif "
                    "qui baisse sans rien",
                    "avoir prédit. Ne les lisez pas comme un résultat.",
                ]
        else:
            blocks += [
                "",
                "--- BACKTEST " + "-" * 59,
                f"Non applicable : l'événement « {self.config.label.kind} » ne porte pas de "
                "direction.",
            ]
        return "\n".join(blocks)


def run(cfg: Config, include_slow: bool = True) -> Result:
    prices = data.load(cfg.data)
    dataset = build_dataset(prices, cfg, include_slow=include_slow)

    baseline = model.rolling_baseline(
        dataset.y, cfg.label.horizon, cfg.split.baseline_window
    )
    predictions = model.walk_forward_predict(
        dataset.X, dataset.y, dataset.res_pos, cfg.split, cfg.model, baseline=baseline
    )
    report = evaluate.evaluate(predictions)

    bt = None
    if cfg.label.kind in DIRECTIONAL_EVENTS:
        bt = backtest.run(prices, predictions, cfg.backtest)

    return Result(cfg, labels.describe(cfg.label), dataset, predictions, report, bt)
