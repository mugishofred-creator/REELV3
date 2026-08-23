"""Backtest honnête à partir des probabilités hors-échantillon.

Trois garde-fous que le bot d'origine n'avait pas :

- Seules les probabilités **hors-échantillon** du walk-forward sont utilisées.
  Rejouer un signal calculé aujourd'hui sur tout l'historique, c'est mesurer sa
  propre mémoire.
- **Décalage d'exécution.** Le signal issu de la clôture de ``t`` est exécuté à
  la clôture de ``t+lag``. Trader au prix qui a servi à calculer le signal est
  le biais le plus courant et le plus flatteur.
- **Coûts.** Le spread est payé sur le *turnover*. Sur de l'EUR/USD quotidien,
  c'est ce poste qui décide seul de la viabilité d'une stratégie.

La taille de position est proportionnelle à l'*edge* — l'écart entre la
probabilité et le taux de base — et non à un signal binaire. C'est le seul usage
qui exploite réellement une probabilité calibrée : une conviction de 0.51 et une
conviction de 0.65 ne méritent pas la même exposition.
"""

from __future__ import annotations

from dataclasses import dataclass, asdict

import numpy as np
import pandas as pd

from .config import BacktestConfig

TRADING_DAYS = 252


@dataclass(frozen=True)
class BacktestResult:
    n_bars: int
    total_return: float
    buy_hold_return: float
    sharpe: float
    max_drawdown: float
    hit_rate: float
    exposure: float
    turnover: float
    total_costs: float
    final_balance: float
    equity: pd.Series

    def to_text(self) -> str:
        rows = {k: v for k, v in asdict(self).items() if k != "equity"}
        width = max(len(k) for k in rows)
        lines = [f"{k:<{width}} : {v:,.4f}" if isinstance(v, float) else f"{k:<{width}} : {v}"
                 for k, v in rows.items()]
        edge = self.total_return - self.buy_hold_return
        lines.append("")
        lines.append(
            f">>> {'Bat' if edge > 0 else 'Ne bat pas'} le buy & hold "
            f"({edge:+.2%} d'écart, coûts inclus)"
        )
        return "\n".join(lines)


def position_from_probability(
    p: pd.Series, baseline: pd.Series, cfg: BacktestConfig
) -> pd.Series:
    """Convertit une probabilité en exposition dans [-max_position, +max_position].

    L'edge est mesuré *par rapport au taux de base du fold*, pas à 0.5 : si un
    actif monte 53 % des jours, annoncer 0.53 n'est pas un signal d'achat, c'est
    l'absence de signal.
    """
    edge = p - baseline
    dead_zone = np.where(edge.abs() < cfg.edge_threshold, 0.0, edge)
    # Un edge de 2× le seuil sature la position : sizing linéaire, borné.
    scaled = dead_zone / (2 * cfg.edge_threshold)
    return pd.Series(
        np.clip(scaled, -cfg.max_position, cfg.max_position), index=p.index, name="position"
    )


def run(
    prices: pd.DataFrame, predictions: pd.DataFrame, cfg: BacktestConfig
) -> BacktestResult:
    """Rejoue la stratégie sur la période hors-échantillon.

    ``prices`` doit couvrir l'index de ``predictions``.
    """
    close = prices["close"].astype(float)
    position = position_from_probability(predictions["p"], predictions["baseline"], cfg)

    window = close.loc[predictions.index[0] :]
    bar_return = window.pct_change().fillna(0.0)

    # Décalage d'exécution : la position décidée en t s'applique au rendement
    # qui arrive en t+lag. Aucune barre ne peut se trader à son propre signal.
    effective = position.reindex(window.index).ffill().fillna(0.0).shift(cfg.execution_lag).fillna(0.0)

    gross = effective * bar_return
    turnover = effective.diff().abs().fillna(effective.abs())
    costs = turnover * (cfg.spread_bps / 10_000.0)
    net = gross - costs

    equity = cfg.initial_balance * (1.0 + net).cumprod()
    drawdown = equity / equity.cummax() - 1.0
    traded = net[effective != 0]

    return BacktestResult(
        n_bars=len(window),
        total_return=float(equity.iloc[-1] / cfg.initial_balance - 1.0),
        buy_hold_return=float(window.iloc[-1] / window.iloc[0] - 1.0),
        sharpe=float(net.mean() / net.std() * np.sqrt(TRADING_DAYS)) if net.std() > 0 else 0.0,
        max_drawdown=float(drawdown.min()),
        hit_rate=float((traded > 0).mean()) if len(traded) else 0.0,
        exposure=float((effective != 0).mean()),
        turnover=float(turnover.sum()),
        total_costs=float(costs.sum()),
        final_balance=float(equity.iloc[-1]),
        equity=equity,
    )
