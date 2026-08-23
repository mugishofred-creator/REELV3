"""Structure intraday : le risque y est prévisible, le rendement non.

Une intuition répandue veut que l'intraday soit « le seul levier où créer un
edge par la gestion du risque ». Elle contient un fait vrai et une erreur.

**Le fait vrai.** La volatilité intraday a une structure quasi déterministe —
le U de la séance, forte à l'ouverture, creuse à la mi-journée, remontant à la
clôture. Mesuré sur SPY en barres de 5 minutes : la **seule heure de la
journée** explique **R² = 0.309** de la variance de ``|rendement|``. En
quotidien, le jour de la semaine en explique 0.005. Un facteur 66. Le risque
intraday est effectivement d'un tout autre ordre de prévisibilité.

**L'erreur.** Le théorème d'arrêt optionnel ne dépend pas de la fréquence. Si
le prix est une martingale, aucune règle d'arrêt ni de dimensionnement ne
déplace l'espérance — en 5 minutes pas plus qu'en quotidien. Changer de
fréquence multiplie le nombre de paris à espérance nulle, et les frais avec.

Pour qu'une meilleure connaissance du risque produise un gain, il faut que le
**rapport rendement/risque** varie selon l'heure — sinon réduire l'exposition
quand la volatilité est haute réduit le rendement dans la même proportion.
Ce module mesure les deux.

Résultat mesuré (10 ETF, barres horaires, 2023-2026) : le ratio varie bel et
bien — 0.044 à 13h contre ~0 à 10h, 12h et 14h. Mais l'exploiter demande
503 transactions par an, et la stratégie devient négative dès **1 bp par
côté**, contre un Sharpe de 1.40 pour une détention permanente sans aucune
transaction. Comme l'effet nuit de la section 12 : réel, stable, incapturable.
"""

from __future__ import annotations

import logging

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)


def seasonality_r2(returns: pd.Series, by: str = "hour") -> float:
    """Part de la variance de ``|rendement|`` expliquée par la seule saisonnalité.

    C'est la mesure directe de « le risque est-il prévisible ? » sans aucun
    modèle : on compare la dispersion autour de la moyenne globale à celle
    autour de la moyenne du créneau. Un R² élevé signifie qu'un simple tableau
    horaire prédit déjà le risque.
    """
    magnitude = returns.abs().dropna()
    if len(magnitude) < 50:
        return float("nan")

    index = magnitude.index
    key = index.hour if by == "hour" else index.dayofweek
    seasonal = magnitude.groupby(key).transform("mean")

    total = float(((magnitude - magnitude.mean()) ** 2).sum())
    residual = float(((magnitude - seasonal) ** 2).sum())
    return 1.0 - residual / total if total > 0 else float("nan")


def hourly_profile(prices: pd.DataFrame, session: tuple[int, int] = (9, 16)) -> pd.DataFrame:
    """Rendement, risque et **ratio** par heure, avec la t-stat de la moyenne.

    Le ratio est la colonne qui décide : c'est lui, et non la volatilité seule,
    qui détermine si connaître le risque sert à quelque chose. Une volatilité
    parfaitement prévisible dont le rendement varie proportionnellement ne
    laisse aucune place à un gain.

    Rappel de lecture : une séance compte sept créneaux, donc sept tests. Le
    seuil de significativité doit monter en conséquence — |t| > 2.7 environ
    après correction de Bonferroni.
    """
    returns = np.log(prices).diff()
    hours = returns.index.hour
    mask = (hours >= session[0]) & (hours <= session[1])
    returns, hours = returns[mask], hours[mask]

    rows = []
    for hour in sorted(set(hours)):
        block = returns[hours == hour].to_numpy(dtype=float).ravel()
        block = block[np.isfinite(block)]
        if len(block) < 200:
            continue
        mean, std = block.mean(), block.std()
        rows.append({
            "heure": hour,
            "rendement_bps": round(mean * 1e4, 3),
            "vol_bps": round(std * 1e4, 1),
            "ratio": round(mean / std, 4) if std > 0 else float("nan"),
            "t_stat": round(mean / (std / np.sqrt(len(block))), 2) if std > 0 else float("nan"),
            "n": len(block),
        })

    if not rows:
        # Aucun créneau n'atteint le minimum d'observations. Sans ce garde-fou,
        # ``set_index`` levait un KeyError sur une colonne absente — une erreur
        # qui n'indique pas la vraie cause.
        logger.warning("Aucun créneau horaire avec assez d'observations "
                       "(minimum 200 par heure)")
        table = pd.DataFrame(columns=["rendement_bps", "vol_bps", "ratio", "t_stat", "n"])
        table.index.name = "heure"
        table.attrs["n_tests"] = 0
        table.attrs["bonferroni_threshold"] = float("nan")
        return table

    table = pd.DataFrame(rows).set_index("heure")
    table.attrs["n_tests"] = len(table)
    table.attrs["bonferroni_threshold"] = round(float(np.sqrt(2) *
                                                      abs(_inverse_normal(0.025 / max(len(table), 1)))), 2)
    return table


def _inverse_normal(p: float) -> float:
    """Quantile normal par bissection — évite une dépendance à scipy."""
    low, high = -10.0, 10.0
    for _ in range(200):
        mid = (low + high) / 2
        # fonction de répartition via erf
        from math import erf, sqrt
        if 0.5 * (1 + erf(mid / sqrt(2))) < p:
            low = mid
        else:
            high = mid
    return (low + high) / 2


def hold_only_hours(prices: pd.DataFrame, hours: list[int], cost_bps: float = 1.0,
                    trading_days: int = 252) -> dict:
    """Détenir un panier équipondéré **uniquement** pendant certaines heures.

    Chaque entrée et chaque sortie compte : ne tenir qu'un créneau par jour
    coûte déjà environ 500 transactions par an. C'est ce coût, et non la qualité
    du créneau, qui décide.
    """
    returns = np.log(prices).diff().mean(axis=1)
    held = pd.Series(np.isin(returns.index.hour, hours).astype(float), index=returns.index)

    turnover = held.diff().abs().fillna(held.abs())
    net = (held * returns - turnover * cost_bps / 10_000).dropna()

    n_days = returns.index.normalize().nunique()
    years = n_days / trading_days
    equity = (1 + net).cumprod()
    bars_per_year = len(net) / years

    return {
        "annualise": float(equity.iloc[-1] ** (1 / years) - 1),
        "sharpe": float(net.mean() / net.std() * np.sqrt(bars_per_year)) if net.std() > 0 else 0.0,
        "drawdown": float((equity / equity.cummax() - 1).min()),
        "transactions_par_an": float(turnover.sum() / years),
        "equity": equity,
    }
