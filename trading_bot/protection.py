"""Borner la perte : ce que ça coûte, exactement.

Deux demandes souvent confondues, dont une seule est réalisable.

**« Rendre la perte impossible » : faisable.** C'est un produit standard. On
place aujourd'hui la valeur actuelle du capital en actif sans risque — de sorte
qu'elle vaille exactement le capital initial à l'échéance — et on investit le
reste. La perte nominale à l'échéance est nulle par construction. Ce n'est pas
un tour de passe-passe : c'est un achat, et son prix est le rendement auquel on
renonce.

**« Augmenter l'espérance de gain par la gestion du risque » : impossible.**
Théorème d'arrêt optionnel (section 10). Aucune règle de dimensionnement ou
d'arrêt ne déplace l'espérance arithmétique d'un jeu équitable.

**Mais une nuance décisive existe.** Ce qui enrichit n'est pas la moyenne
arithmétique, c'est la **croissance géométrique** :

    g ≈ μ − σ²/2

Le terme ``−σ²/2`` est le *frein de volatilité*. Réduire σ **sans réduire μ**
augmente g. C'est mathématiquement vrai, et c'est précisément ce que fait la
diversification — le seul mécanisme connu qui réduise la variance sans toucher
à la moyenne. Toute autre réduction de risque (moins d'exposition, protection
du capital) réduit μ **proportionnellement** et laisse g inchangé ou moindre.

D'où la grille de lecture de ce module :

- ``capital_floor`` : borne la perte, à un prix affiché.
- ``cppi`` : borne la perte dynamiquement, avec un risque de saut résiduel.
- ``volatility_drag`` : mesure le seul gain réellement gratuit.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)
TRADING_DAYS = 252


@dataclass(frozen=True)
class ProtectionResult:
    name: str
    total_return: float
    annualised: float
    geometric: float
    arithmetic: float
    volatility: float
    max_drawdown: float
    worst_year: float
    prob_loss: float
    equity: pd.Series

    def row(self) -> dict:
        return {
            "structure": self.name,
            "annualisé": round(self.annualised, 4),
            "μ arithmétique": round(self.arithmetic, 4),
            "g géométrique": round(self.geometric, 4),
            "frein σ²/2": round(self.arithmetic - self.geometric, 4),
            "volatilité": round(self.volatility, 4),
            "DD max": round(self.max_drawdown, 4),
            "pire année": round(self.worst_year, 4),
            "P(perte annuelle)": round(self.prob_loss, 3),
        }


def _measure(name: str, returns: pd.Series) -> ProtectionResult:
    """Sépare explicitement moyenne arithmétique et croissance géométrique."""
    returns = returns.dropna()
    equity = (1 + returns).cumprod()
    years = len(returns) / TRADING_DAYS

    arithmetic = float(returns.mean() * TRADING_DAYS)
    geometric = float(np.log1p(returns).mean() * TRADING_DAYS)
    annual = equity.resample("YE").last().pct_change().dropna() if len(equity) > 300 else pd.Series(dtype=float)

    return ProtectionResult(
        name=name,
        total_return=float(equity.iloc[-1] - 1),
        annualised=float(equity.iloc[-1] ** (1 / years) - 1),
        geometric=geometric,
        arithmetic=arithmetic,
        volatility=float(returns.std() * np.sqrt(TRADING_DAYS)),
        max_drawdown=float((equity / equity.cummax() - 1).min()),
        worst_year=float(annual.min()) if len(annual) else float("nan"),
        prob_loss=float((annual < 0).mean()) if len(annual) else float("nan"),
        equity=equity,
    )


def capital_floor(risky_returns: pd.Series, horizon_years: float,
                  risk_free_rate: float, floor: float = 1.0) -> ProtectionResult:
    """Protection statique : la perte nominale à l'échéance est nulle.

    On immobilise ``floor / (1 + r)^T`` en sans-risque, ce qui vaudra exactement
    ``floor`` à l'échéance. Le reste part en risque. La part risquée est donc
    **entièrement déterminée par les taux et l'horizon** — pas par une opinion
    de marché.

    À 3,6 % sur 5 ans, il reste 16 % à investir. Sur 10 ans, 30 %. C'est le prix
    affiché de la garantie, et il n'est pas négociable : plus les taux sont bas,
    plus la protection est chère.
    """
    present_value = floor / (1 + risk_free_rate) ** horizon_years
    participation = max(0.0, 1.0 - present_value)

    daily_rf = (1 + risk_free_rate) ** (1 / TRADING_DAYS) - 1
    blended = participation * risky_returns + (1 - participation) * daily_rf

    label = (f"Plancher {floor:.0%} à {horizon_years:g} ans "
             f"(participation {participation:.0%})")
    return _measure(label, blended)


def cppi(risky_returns: pd.Series, multiplier: float = 3.0, floor: float = 0.80,
         risk_free_rate: float = 0.03, max_exposure: float = 1.0) -> ProtectionResult:
    """Protection dynamique (CPPI) : exposition = m × (valeur − plancher).

    Le coussin se réduit à mesure qu'on approche du plancher, donc l'exposition
    aussi. En temps continu la perte serait bornée ; en temps discret elle ne
    l'est pas — un saut de plus de ``1/m`` en une séance traverse le plancher.
    C'est le **risque de gap**, et il est réel : avec m = 5, une chute de 20 %
    en une séance suffit.

    Le plancher est ici **cliquet** : il monte avec le capital et ne redescend
    jamais, ce qui verrouille les gains acquis.
    """
    returns = risky_returns.dropna()
    daily_rf = (1 + risk_free_rate) ** (1 / TRADING_DAYS) - 1

    value = 1.0
    high_water = 1.0
    series = []

    for r in returns.to_numpy(dtype=float):
        current_floor = floor * high_water
        cushion = max(0.0, value - current_floor)
        exposure = min(max_exposure, multiplier * cushion / value) if value > 0 else 0.0

        value *= 1 + exposure * r + (1 - exposure) * daily_rf
        high_water = max(high_water, value)
        series.append(exposure * r + (1 - exposure) * daily_rf)

    return _measure(f"CPPI m={multiplier:g}, plancher {floor:.0%} (cliquet)",
                    pd.Series(series, index=returns.index))


def volatility_drag(returns: pd.Series) -> dict:
    """Le seul gain réellement gratuit, chiffré.

    ``g ≈ μ − σ²/2``. Le frein croît avec le **carré** de la volatilité : le
    diviser par deux en divise le frein par quatre. C'est pourquoi la
    diversification, qui réduit σ sans toucher à μ, est le seul mécanisme qui
    augmente vraiment ce qui compose — et pourquoi réduire l'exposition, qui
    réduit les deux, n'y change rien.
    """
    returns = returns.dropna()
    arithmetic = float(returns.mean() * TRADING_DAYS)
    geometric = float(np.log1p(returns).mean() * TRADING_DAYS)
    volatility = float(returns.std() * np.sqrt(TRADING_DAYS))
    return {
        "μ arithmétique": arithmetic,
        "g géométrique": geometric,
        "frein observé": arithmetic - geometric,
        "σ²/2 théorique": volatility**2 / 2,
        "volatilité": volatility,
    }
