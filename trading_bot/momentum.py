"""Momentum cross-sectionnel : classer, pas prédire.

Différence de nature avec tout ce qui a échoué jusqu'ici. Les tentatives
précédentes demandaient : *cet actif va-t-il monter ?* — une prévision en
niveau, sur un actif isolé, à un jour. Ici on demande seulement : *lesquels de
ces actifs ont le mieux performé sur un an, et cette hiérarchie persiste-t-elle
le mois prochain ?*

C'est une question **relative**, ce qui la rend structurellement plus robuste :
un choc commun à tout le marché s'annule entre les jambes longue et courte, et
le classement ne dépend d'aucun niveau de prix particulier.

Trois choix qui suivent la littérature (Jegadeesh & Titman) et qui ne sont pas
cosmétiques :

1. **Fenêtre de 12 mois en sautant le dernier mois.** Le mois le plus récent est
   volontairement exclu : c'est là que vit le retour à la moyenne court terme —
   celui-là même qui s'est révélé être un artefact de microstructure dans ce
   dépôt. L'inclure mélangerait deux effets de signes opposés, dont un faux.
2. **Rebalancement mensuel.** Un signal à 12 mois n'a aucune raison d'être
   rafraîchi quotidiennement, et le turnover coûte.
3. **Pondération par le risque au sein de chaque jambe.** Sans elle, les
   secteurs volatils dominent le portefeuille indépendamment de leur rang.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

import numpy as np
import pandas as pd

from .config import Config

logger = logging.getLogger(__name__)
TRADING_DAYS = 252

#: Secteurs US, marchés pays, et diversifiants. La diversité est délibérée :
#: le momentum cross-sectionnel a besoin d'une dispersion réelle entre les
#: candidats pour que le classement porte de l'information.
MOMENTUM_UNIVERSE = (
    "XLK", "XLF", "XLE", "XLV", "XLI", "XLY", "XLP", "XLU", "XLB",
    "EWJ", "EWG", "EWU", "EWA", "EWC", "EWZ", "EWY", "EWT", "EWH",
    "TLT", "IEF", "GLD", "SLV", "DBC", "VNQ",
)


def load_universe(symbols: list[str], cfg: Config) -> pd.DataFrame:
    from . import data as data_module

    series = {}
    for symbol in symbols:
        try:
            frame = data_module.load(
                type(cfg.data)(**{**cfg.data.__dict__, "symbol": symbol, "adjusted": True})
            )
            series[symbol] = frame["close"].astype(float)
        except Exception as exc:
            logger.warning("%s ignoré : %s", symbol, exc)
    if not series:
        raise ValueError("Aucun actif chargé.")
    return pd.DataFrame(series).sort_index().dropna()


def momentum_score(prices: pd.DataFrame, lookback: int = 252,
                   skip: int = 21) -> pd.DataFrame:
    """Rendement sur ``lookback`` barres, **en excluant** les ``skip`` dernières.

    Le saut n'est pas un détail de mise au point : sans lui, le score mélange le
    momentum à douze mois avec le retour à la moyenne à un mois, deux effets de
    signes opposés qui s'annulent partiellement.
    """
    log_price = np.log(prices)
    return log_price.shift(skip) - log_price.shift(lookback)


def _drift_weights(target: pd.DataFrame, returns: pd.DataFrame,
                   rebalance_days: int) -> pd.DataFrame:
    from .allocation import _drift_weights as drift
    return drift(target, returns, rebalance_days)


@dataclass(frozen=True)
class MomentumResult:
    name: str
    annualised: float
    volatility: float
    sharpe: float
    max_drawdown: float
    calmar: float
    turnover: float
    equity: pd.Series

    def row(self) -> dict:
        return {"stratégie": self.name, "annualisé": round(self.annualised, 4),
                "volatilité": round(self.volatility, 4), "sharpe": round(self.sharpe, 3),
                "DD max": round(self.max_drawdown, 4), "calmar": round(self.calmar, 3),
                "turnover/an": round(self.turnover, 2)}


def _evaluate(name: str, weights: pd.DataFrame, prices: pd.DataFrame,
              cost_bps: float, execution_lag: int) -> MomentumResult:
    returns = prices.pct_change().fillna(0.0)
    applied = weights.shift(execution_lag).fillna(0.0)

    turnover = applied.diff().abs().sum(axis=1).fillna(applied.abs().sum(axis=1))
    net = (applied * returns).sum(axis=1) - turnover * (cost_bps / 10_000.0)

    equity = (1 + net).cumprod()
    drawdown = equity / equity.cummax() - 1.0
    years = len(net) / TRADING_DAYS
    annualised = float(equity.iloc[-1] ** (1 / years) - 1)
    max_dd = float(drawdown.min())

    return MomentumResult(
        name=name, annualised=annualised,
        volatility=float(net.std() * np.sqrt(TRADING_DAYS)),
        sharpe=float(net.mean() / net.std() * np.sqrt(TRADING_DAYS)) if net.std() > 0 else 0.0,
        max_drawdown=max_dd,
        calmar=float(annualised / abs(max_dd)) if max_dd < 0 else 0.0,
        turnover=float(turnover.sum() / years), equity=equity,
    )


def cross_sectional(prices: pd.DataFrame, cost_bps: float = 2.0,
                    lookback: int = 252, skip: int = 21, quantile: float = 1 / 3,
                    long_short: bool = True, rebalance_days: int = 21,
                    vol_window: int = 60, execution_lag: int = 1) -> MomentumResult:
    """Long les meilleurs, court les pires, pondérés par l'inverse de la volatilité."""
    score = momentum_score(prices, lookback, skip)
    returns = prices.pct_change()
    vol = returns.rolling(vol_window, min_periods=vol_window // 2).std().shift(1)
    inverse = (1.0 / vol).replace([np.inf, -np.inf], np.nan)

    ranks = score.rank(axis=1, pct=True)
    long_leg = (ranks > 1 - quantile).astype(float)
    short_leg = (ranks < quantile).astype(float) if long_short else 0.0

    def normalise(leg):
        weighted = leg * inverse
        total = weighted.sum(axis=1).replace(0, np.nan)
        return weighted.div(total, axis=0).fillna(0.0)

    target = normalise(long_leg)
    if long_short:
        target = target - normalise(short_leg)

    target = target.where(score.notna().all(axis=1), np.nan)
    weights = _drift_weights(target.fillna(0.0), returns, rebalance_days)
    label = "Momentum long/short" if long_short else "Momentum long only"
    return _evaluate(f"{label} ({lookback}j, saut {skip}j)", weights, prices,
                     cost_bps, execution_lag)


def equal_weight(prices: pd.DataFrame, cost_bps: float = 2.0,
                 rebalance_days: int = 21, execution_lag: int = 1) -> MomentumResult:
    """Référence : équipondéré sur le même univers, rebalancé au même rythme."""
    n = prices.shape[1]
    target = pd.DataFrame(1.0 / n, index=prices.index, columns=prices.columns)
    weights = _drift_weights(target, prices.pct_change(), rebalance_days)
    return _evaluate("Équipondéré (référence)", weights, prices, cost_bps, execution_lag)


def lag_robustness(prices: pd.DataFrame, cost_bps: float = 2.0,
                   lags: tuple[int, ...] = (1, 2, 5, 10), **kw) -> pd.DataFrame:
    """Un signal à douze mois ne doit rien devoir au print de clôture du jour."""
    rows = [{"lag": lag,
             "sharpe": round(cross_sectional(prices, cost_bps, execution_lag=lag, **kw).sharpe, 3)}
            for lag in lags]
    table = pd.DataFrame(rows).set_index("lag")
    reference = table.loc[lags[0], "sharpe"]
    table.attrs["stable"] = bool(reference > 0 and (table["sharpe"] > 0.7 * reference).all())
    return table
