"""Carry FX : la prime de portage, et ce qu'elle coûte vraiment.

Troisième prime de risque testée dans ce dépôt, après l'allocation et le
momentum. Le principe ne demande aucune prévision : on est long les devises à
taux élevé et court celles à taux bas, et l'on encaisse le différentiel. Si la
parité des taux d'intérêt non couverte tenait, le taux de change compenserait
exactement ce différentiel et le rendement serait nul. Empiriquement elle ne
tient pas — d'où une prime.

Le rendement total de détenir une devise ``X`` contre le dollar est :

    rendement = variation du spot + (taux_X − taux_USD) × jours / 365

Piège d'implémentation : les paires Yahoo ``JPY=X``, ``CHF=X``, ``CAD=X``,
``SEK=X``, ``NOK=X`` et ``MXN=X`` cotent **USD/xxx**. Le rendement de la devise
étrangère est alors l'opposé de la variation de la paire. Se tromper de signe
inverserait six des dix devises.

Résultat mesuré (2005-2026, 10 devises, 2 bps/côté) : Sharpe 0.29, −37 % de
drawdown, t-stat 1.46 — **non significatif**. C'est le profil documenté du
carry : une prime modeste payée pour porter un risque de krach, qui se
matérialise brutalement (2008, 2015). Le panier équipondéré de devises, lui,
rend −0,9 % par an : la prime existe bien dans le classement, elle n'est
simplement pas assez grande pour être distinguable du bruit sur vingt ans.
"""

from __future__ import annotations

import logging

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)
TRADING_DAYS = 252

#: Devise -> (symbole Yahoo, signe). Le signe vaut −1 quand la paire cote
#: USD/xxx : le rendement de la devise étrangère est alors l'opposé.
CURRENCY_PAIRS = {
    "EUR": ("EURUSD=X", 1), "GBP": ("GBPUSD=X", 1),
    "AUD": ("AUDUSD=X", 1), "NZD": ("NZDUSD=X", 1),
    "JPY": ("JPY=X", -1), "CHF": ("CHF=X", -1), "CAD": ("CAD=X", -1),
    "SEK": ("SEK=X", -1), "NOK": ("NOK=X", -1), "MXN": ("MXN=X", -1),
}


def total_returns(spot_returns: pd.DataFrame, rates: pd.DataFrame,
                  base: str = "USD") -> tuple[pd.DataFrame, pd.DataFrame]:
    """Rendement total en devise de base, et différentiel de taux annualisé.

    Le portage est proraté sur les jours **calendaires** : un week-end porte
    trois jours d'intérêt, pas un.
    """
    index = spot_returns.index
    differential = pd.DataFrame(
        {c: (rates[c] - rates[base]).reindex(index).ffill() for c in spot_returns.columns}
    )
    elapsed = pd.Series(index, index=index).diff().dt.days.fillna(1.0)
    carry = differential.mul(elapsed / 365.0, axis=0)
    return spot_returns.add(carry, fill_value=0.0), differential


def carry_portfolio(total: pd.DataFrame, differential: pd.DataFrame,
                    quantile: float = 0.3, rebalance_days: int = 21,
                    cost_bps: float = 2.0, execution_lag: int = 1) -> pd.Series:
    """Long les devises du haut du classement, court celles du bas.

    Le classement se fait sur le différentiel de taux **connu à la date de
    décision** — c'est une donnée publique et stable, sans risque de fuite.
    """
    ranks = differential.reindex(total.index).rank(axis=1, pct=True)
    rebalance = pd.Series(np.arange(len(total)) % rebalance_days == 0, index=total.index)

    def leg(condition: pd.DataFrame) -> pd.DataFrame:
        weights = condition.astype(float)
        weights = weights.div(weights.sum(axis=1).replace(0, np.nan), axis=0).fillna(0.0)
        return weights.where(rebalance, np.nan).ffill().fillna(0.0)

    weights = leg(ranks > 1 - quantile) - leg(ranks < quantile)
    applied = weights.shift(execution_lag).fillna(0.0)

    turnover = applied.diff().abs().sum(axis=1).fillna(applied.abs().sum(axis=1))
    return (applied * total).sum(axis=1) - turnover * (cost_bps / 10_000.0)


def newey_west_tstat(returns: pd.Series, lags: int = 21) -> float:
    """t-stat de la moyenne, corrigée de l'autocorrélation.

    Indispensable ici : le rebalancement mensuel fait se chevaucher les
    rendements, et une t-stat naïve surestimerait largement la significativité.
    Un edge dont le t reste sous 2 après cette correction n'est pas
    distinguable de la chance.
    """
    values = returns.to_numpy(dtype=float)
    n = len(values)
    variance = float((values**2).sum())
    for lag in range(1, lags + 1):
        weight = 1 - lag / (lags + 1)
        variance += 2 * weight * float((values[lag:] * values[:-lag]).sum())
    return float(values.mean() * n / np.sqrt(variance)) if variance > 0 else 0.0
