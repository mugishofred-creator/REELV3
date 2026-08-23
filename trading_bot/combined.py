"""Stratégie intégrée : chaque brique validée à sa place fonctionnelle.

Ce projet a produit quatre résultats qui ont survécu à tous les contrôles, et
une combinaison naïve qui a échoué. L'échec est instructif : additionner les
rendements de l'allocation (Sharpe 0.822) et du momentum (0.702) donne 0.812 —
moins que la meilleure brique seule. Parce qu'elles sont **corrélées à 0.76** :
ce sont deux façons de porter la même prime actions, pas deux paris.

L'intégration est différente de l'addition. Chaque brique intervient là où elle
a démontré sa valeur, et une seule fois :

- **Momentum** → *sélection*. Il classe correctement (t = +3.41, robuste au
  décalage) mais son gain était en contrôle du drawdown, pas en rendement. On
  l'emploie donc à écarter le bas du classement, pas à concentrer sur le haut.
- **Parité de risque** → *pondération*. Sans elle, l'actif le plus volatil
  dicte seul la variance du portefeuille.
- **Ciblage de volatilité** → *dimensionnement*, sur la volatilité **réalisée
  passée**. La prévision, pourtant meilleure comme prévision (R² 0.576 contre
  0.456), dégradait le portefeuille : Sharpe 0.847 contre 0.902. Le gain de
  précision porte sur des régimes brefs dont l'exploitation coûte plus en
  turnover qu'elle ne rapporte. On garde donc l'estimateur simple.
- **Asymétrie des queues** → *inclinaison marginale*, et bornée. Le résidu
  orthogonalisé est le meilleur signal directionnel du projet, et il reste
  non établi (t = 2.12, 69 % du gain sur dix journées). Il ne peut donc pas
  décider de l'exposition, seulement la moduler à la marge.

Les poids ne sont pas optimisés sur les résultats : chaque brique a été validée
séparément et entre avec un rôle fixé a priori. Optimiser le mélange sur la même
période réintroduirait exactement le biais que tout le reste écarte.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

import numpy as np
import pandas as pd

from .allocation import TRADING_DAYS, _drift_weights, _evaluate
from .config import Config

logger = logging.getLogger(__name__)

#: Univers large : primes de risque, secteurs, zones géographiques.
#: La largeur sert le momentum, qui a besoin de dispersion pour classer.
INTEGRATED_UNIVERSE = (
    "SPY", "QQQ", "EFA", "EEM", "TLT", "IEF", "VNQ", "GLD",
    "XLK", "XLF", "XLE", "XLV", "XLI", "XLY", "XLP", "XLU", "XLB",
    "EWJ", "EWG", "EWU", "SLV", "DBC",
)


@dataclass(frozen=True)
class Layer:
    """Une brique et son rôle. Sert à documenter ce qui est activé."""

    selection: bool = True        # momentum
    risk_parity: bool = True      # pondération
    vol_target: bool = True       # dimensionnement
    tilt: bool = False            # asymétrie des queues

    def label(self) -> str:
        parts = []
        parts.append("sélection" if self.selection else "tout l'univers")
        parts.append("parité de risque" if self.risk_parity else "équipondéré")
        if self.vol_target:
            parts.append("vol ciblée")
        if self.tilt:
            parts.append("inclinaison")
        return " + ".join(parts)


def build_weights(prices: pd.DataFrame, layers: Layer, tilt: pd.DataFrame | None = None,
                  lookback: int = 252, skip: int = 21, keep: float = 0.6,
                  vol_window: int = 60, target_vol: float = 0.10,
                  max_leverage: float = 2.0, rebalance_days: int = 21,
                  tilt_strength: float = 0.3) -> pd.DataFrame:
    """Assemble les poids cibles couche par couche."""
    returns = prices.pct_change()
    log_price = np.log(prices)

    # --- Sélection : on écarte le bas du classement momentum -----------------
    if layers.selection:
        score = log_price.shift(skip) - log_price.shift(lookback)
        ranks = score.rank(axis=1, pct=True)
        eligible = (ranks > 1 - keep).astype(float)
        # Tant qu'aucun score n'existe, on reste sur l'univers complet plutôt
        # que sur un portefeuille vide.
        eligible = eligible.where(score.notna().any(axis=1), 1.0)
    else:
        eligible = pd.DataFrame(1.0, index=prices.index, columns=prices.columns)

    # --- Pondération ----------------------------------------------------------
    vol = returns.rolling(vol_window, min_periods=vol_window // 2).std().shift(1)
    if layers.risk_parity:
        raw = eligible / vol.replace(0, np.nan)
    else:
        raw = eligible.copy()
    raw = raw.replace([np.inf, -np.inf], np.nan)

    # --- Inclinaison marginale, bornée ---------------------------------------
    if layers.tilt and tilt is not None:
        aligned = tilt.reindex(index=prices.index, columns=prices.columns).ffill()
        # Centré sur la médiane transversale du jour, borné à ±tilt_strength :
        # le signal module, il ne décide jamais seul de l'exposition.
        centred = aligned.sub(aligned.median(axis=1), axis=0)
        scale = centred.div(centred.abs().max(axis=1).replace(0, np.nan), axis=0)
        raw = raw * (1.0 + tilt_strength * scale.fillna(0.0).clip(-1, 1))
        raw = raw.clip(lower=0.0)

    weights = raw.div(raw.sum(axis=1).replace(0, np.nan), axis=0).fillna(0.0)

    # --- Dimensionnement ------------------------------------------------------
    if layers.vol_target:
        portfolio_returns = (weights.shift(1) * returns).sum(axis=1)
        realised = portfolio_returns.rolling(vol_window, min_periods=vol_window // 2).std()
        realised = realised.shift(1) * np.sqrt(TRADING_DAYS)
        leverage = (target_vol / realised).clip(upper=max_leverage)
        weights = weights.mul(leverage, axis=0)

    return _drift_weights(weights.fillna(0.0), returns, rebalance_days)


def run(prices: pd.DataFrame, layers: Layer, cost_bps: float = 2.0,
        execution_lag: int = 1, tilt: pd.DataFrame | None = None, **kw):
    weights = build_weights(prices, layers, tilt=tilt, **kw)
    return _evaluate(layers.label(), weights, prices, cost_bps, execution_lag=execution_lag)


def ablation(prices: pd.DataFrame, cost_bps: float = 2.0,
             tilt: pd.DataFrame | None = None) -> pd.DataFrame:
    """Chaque couche apporte-t-elle quelque chose, ou seulement du turnover ?

    Une intégration ne se juge pas sur son résultat final mais sur ce que chaque
    couche ajoute au-dessus de la précédente. Une couche qui n'améliore rien
    doit sortir — elle ne coûterait que des frais.
    """
    configurations = [
        ("référence équipondérée", Layer(False, False, False, False)),
        ("+ parité de risque", Layer(False, True, False, False)),
        ("+ vol ciblée", Layer(False, True, True, False)),
        ("+ sélection momentum", Layer(True, True, True, False)),
    ]
    if tilt is not None:
        configurations.append(("+ inclinaison asymétrie", Layer(True, True, True, True)))

    rows = []
    for name, layers in configurations:
        result = run(prices, layers, cost_bps=cost_bps, tilt=tilt)
        row = result.row()
        row["stratégie"] = name
        rows.append(row)
    return pd.DataFrame(rows).set_index("stratégie")


def lag_robustness(prices: pd.DataFrame, layers: Layer, cost_bps: float = 2.0,
                   tilt: pd.DataFrame | None = None,
                   lags: tuple[int, ...] = (1, 2, 3, 5)) -> pd.DataFrame:
    rows = [{"lag": lag,
             "sharpe": round(run(prices, layers, cost_bps, lag, tilt).sharpe, 3),
             "annualisé": round(run(prices, layers, cost_bps, lag, tilt).annualised, 4)}
            for lag in lags]
    table = pd.DataFrame(rows).set_index("lag")
    reference = table.loc[lags[0], "sharpe"]
    table.attrs["stable"] = bool(reference > 0 and (table["sharpe"] > 0.7 * reference).all())
    return table


def universe_sensitivity(prices: pd.DataFrame, layers: Layer, n_draws: int = 200,
                         sizes: tuple[int, ...] = (5, 8, 12, 16),
                         cost_bps: float = 2.0, seed: int = 0) -> pd.DataFrame:
    """Le résultat dépend-il du choix de l'univers ?

    Contrôle rarement fait, et pourtant décisif. Un univers est un **choix**, et
    un choix pris en connaissant les données est une forme de sur-apprentissage
    aussi efficace qu'un réglage de paramètre — en plus discret, parce qu'il ne
    ressemble pas à un réglage.

    Le test tire des sous-ensembles aléatoires de tailles croissantes et regarde
    la **distribution** du Sharpe. Deux lectures :

    - Un Sharpe médian stable et un quantile 5 % positif signalent un effet qui
      ne tient pas à la composition retenue.
    - Une dispersion large, ou un quantile bas négatif, signalent qu'on a
      surtout eu la main heureuse sur l'univers.

    On attend une amélioration avec la taille — c'est la diversification, qui
    est le mécanisme même de la stratégie. Ce qui compte est le **plancher**,
    pas la moyenne.
    """
    rng = np.random.default_rng(seed)
    columns = list(prices.columns)
    rows = []

    for size in sizes:
        if size > len(columns):
            continue
        sharpes = []
        for _ in range(n_draws):
            picked = list(rng.choice(columns, size=size, replace=False))
            subset = prices[picked].dropna()
            if len(subset) < 500:
                continue
            sharpes.append(run(subset, layers, cost_bps=cost_bps).sharpe)
        if not sharpes:
            continue
        values = np.array(sharpes)
        rows.append({
            "taille": size,
            "sharpe médian": round(float(np.median(values)), 3),
            "q05": round(float(np.quantile(values, 0.05)), 3),
            "q95": round(float(np.quantile(values, 0.95)), 3),
            "% positifs": round(float((values > 0).mean()), 3),
            "% > 0.5": round(float((values > 0.5).mean()), 3),
        })

    table = pd.DataFrame(rows).set_index("taille")
    # Le résultat est robuste si même les tirages malheureux restent corrects.
    largest = table.iloc[-1] if len(table) else None
    table.attrs["robust"] = bool(
        largest is not None and largest["q05"] > 0.3 and largest["% positifs"] > 0.95
    )
    return table
