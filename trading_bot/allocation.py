"""Stratégie sans prédiction : allocation, diversification, rebalancement.

Ce module répond à une question précise — *la gestion du risque peut-elle être
un edge à elle seule ?* — et la réponse tient en deux temps.

**Non, pas sur un marché à espérance nulle.** C'est un théorème, pas une
opinion. Si le prix est une martingale, le théorème d'arrêt optionnel garantit
que **toute** règle d'arrêt — stop-loss, take-profit, sortie en temps — donne
``E[prix de sortie] = prix d'entrée``. Aucun dimensionnement n'y change quoi que
ce soit : une martingale de mises transforme la *forme* de la distribution (une
médiane flatteuse, un taux de réussite élevé) sans jamais déplacer l'espérance,
et paie cette illusion par une queue catastrophique. Vérifié dans
``tests/test_allocation.py``.

**Oui, appliquée à une prime de risque réelle.** Là, il n'y a rien à prédire :
les actions et les obligations ont une espérance de rendement positive parce
qu'elles rémunèrent un risque, pas parce qu'on saurait quand elles vont monter.
Trois mécanismes purement mécaniques améliorent alors la restitution de cette
prime :

1. **Diversification** : combiner des actifs imparfaitement corrélés réduit la
   volatilité du portefeuille sans réduire son rendement espéré.
2. **Prime de rebalancement** : rééquilibrer vers des poids fixes vend
   mécaniquement ce qui a monté et achète ce qui a baissé. Le rendement
   *géométrique* du portefeuille rebalancé dépasse la moyenne des rendements
   géométriques des composants — un gain qui ne vient d'aucune prévision.
3. **Ciblage de volatilité** : stabiliser le risque améliore le ratio de Sharpe
   et surtout écrase les pertes maximales, ce qui a des conséquences très
   concrètes sur le levier praticable.

Différence essentielle avec la stratégie directionnelle invalidée : celle-ci ne
dépend d'aucun prix de clôture particulier. Elle doit donc **survivre au test de
décalage d'exécution** — c'est le contrôle qui distingue un rendement réel d'un
artefact de microstructure.

Le FX est volontairement absent : une paire de devises n'a **pas de prime de
risque**. C'est un jeu à somme nulle entre deux monnaies. Détenir EUR/USD n'est
pas un investissement rémunéré, c'est un pari — et c'est précisément pour cela
que rien ne fonctionnait dessus.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

import numpy as np
import pandas as pd

from . import data as data_module
from .config import Config

logger = logging.getLogger(__name__)
TRADING_DAYS = 252

#: Univers par défaut : actifs porteurs d'une prime de risque documentée.
#: Actions (large, tech, international, émergents), obligations (long, moyen),
#: immobilier coté, or. Des ETF, donc des instruments réellement traitables,
#: avec dividendes réintégrés via la clôture ajustée.
RISK_PREMIUM_UNIVERSE = (
    "SPY",   # actions US large
    "QQQ",   # actions US tech
    "EFA",   # actions internationales développées
    "EEM",   # actions émergentes
    "TLT",   # obligations US long terme
    "IEF",   # obligations US 7-10 ans
    "VNQ",   # immobilier coté US
    "GLD",   # or
)


@dataclass(frozen=True)
class AllocationResult:
    name: str
    total_return: float
    annualised: float
    volatility: float
    sharpe: float
    max_drawdown: float
    calmar: float
    turnover: float
    total_costs: float
    equity: pd.Series

    def row(self) -> dict:
        return {
            "stratégie": self.name,
            "annualisé": round(self.annualised, 4),
            "volatilité": round(self.volatility, 4),
            "sharpe": round(self.sharpe, 3),
            "DD max": round(self.max_drawdown, 4),
            "calmar": round(self.calmar, 3),
            "turnover/an": round(self.turnover, 2),
            "coûts": round(self.total_costs, 4),
        }


def load_universe(symbols: list[str], cfg: Config) -> pd.DataFrame:
    """Rendements quotidiens alignés, clôtures **ajustées** obligatoires."""
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

    prices = pd.DataFrame(series).sort_index()
    # On n'entre qu'à partir de la date où tous les actifs cotent, sinon le
    # portefeuille change de composition en cours de route et la comparaison
    # entre stratégies ne veut plus rien dire.
    prices = prices.dropna()
    return prices


def _evaluate(name: str, weights: pd.DataFrame, prices: pd.DataFrame,
              cost_bps: float, execution_lag: int = 1) -> AllocationResult:
    """Applique des poids à des prix, avec décalage d'exécution et coûts."""
    returns = prices.pct_change().fillna(0.0)
    applied = weights.shift(execution_lag).fillna(0.0)

    gross = (applied * returns).sum(axis=1)
    turnover = applied.diff().abs().sum(axis=1).fillna(applied.abs().sum(axis=1))
    costs = turnover * (cost_bps / 10_000.0)
    net = gross - costs

    equity = (1 + net).cumprod()
    drawdown = equity / equity.cummax() - 1.0
    years = len(net) / TRADING_DAYS
    annualised = float(equity.iloc[-1] ** (1 / years) - 1)
    volatility = float(net.std() * np.sqrt(TRADING_DAYS))
    max_dd = float(drawdown.min())

    return AllocationResult(
        name=name,
        total_return=float(equity.iloc[-1] - 1),
        annualised=annualised,
        volatility=volatility,
        sharpe=float(net.mean() / net.std() * np.sqrt(TRADING_DAYS)) if net.std() > 0 else 0.0,
        max_drawdown=max_dd,
        calmar=float(annualised / abs(max_dd)) if max_dd < 0 else 0.0,
        turnover=float(turnover.sum() / years),
        total_costs=float(costs.sum()),
        equity=equity,
    )


def _drift_weights(target: pd.DataFrame, returns: pd.DataFrame,
                   rebalance_days: int) -> pd.DataFrame:
    """Poids réellement détenus : fixés aux dates de rebalancement, puis dérivant.

    Point de fond : entre deux rebalancements, les poids **ne restent pas
    constants**. La valeur investie dans chaque ligne évolue avec son rendement,
    donc le poids relatif dérive. Reconduire le poids cible chaque jour
    reviendrait à rebalancer quotidiennement — ce qui gonflerait le turnover et,
    surtout, effacerait la distinction entre les stratégies comparées.

    La formule de dérive tient compte du levier : la valeur liquidative évolue de
    ``1 + Σ wⱼ rⱼ`` et chaque ligne de ``wⱼ(1 + rⱼ)``, ce qui reste correct même
    quand l'exposition totale dépasse 1.
    """
    held = np.zeros(target.shape)
    current: np.ndarray | None = None

    target_values = target.to_numpy(dtype=float)
    return_values = np.nan_to_num(returns.to_numpy(dtype=float))

    for i in range(len(target)):
        is_rebalance = i % rebalance_days == 0
        if is_rebalance and np.isfinite(target_values[i]).all():
            current = target_values[i].copy()
        if current is None:
            continue

        held[i] = current
        nav_growth = 1.0 + float(current @ return_values[i])
        if nav_growth > 0:
            current = current * (1.0 + return_values[i]) / nav_growth

    return pd.DataFrame(held, index=target.index, columns=target.columns)


def buy_and_hold(prices: pd.DataFrame, cost_bps: float, **kw) -> AllocationResult:
    """Référence : équipondéré à l'entrée, jamais rebalancé.

    C'est la bonne référence — et non « SPY seul » — parce qu'elle isole
    exactement ce qu'apporte le *rebalancement*, à univers identique.
    """
    growth = prices / prices.iloc[0]
    weights = growth.div(growth.sum(axis=1), axis=0)   # les poids dérivent librement
    return _evaluate("Buy & hold (dérive libre)", weights, prices, cost_bps, **kw)


def equal_weight_rebalanced(prices: pd.DataFrame, cost_bps: float,
                            rebalance_days: int = 21, **kw) -> AllocationResult:
    """Poids égaux, rebalancés périodiquement. Isole la prime de rebalancement."""
    n = prices.shape[1]
    target = pd.DataFrame(1.0 / n, index=prices.index, columns=prices.columns)
    weights = _drift_weights(target, prices.pct_change(), rebalance_days)
    return _evaluate(f"Équipondéré, rebalancé {rebalance_days}j", weights, prices, cost_bps, **kw)


def risk_parity(prices: pd.DataFrame, cost_bps: float, lookback: int = 60,
                rebalance_days: int = 21, **kw) -> AllocationResult:
    """Parité de risque par volatilité inverse.

    Pondérer à capital égal laisse les actions dicter tout le risque : TLT et
    GLD ne pèsent alors quasiment rien dans la variance du portefeuille. On
    pondère donc par ``1/volatilité``, estimée sur une fenêtre **passée** et
    décalée d'une barre.
    """
    returns = prices.pct_change()
    vol = returns.rolling(lookback, min_periods=lookback // 2).std().shift(1)
    inverse = (1.0 / vol).replace([np.inf, -np.inf], np.nan)
    target = inverse.div(inverse.sum(axis=1), axis=0)

    weights = _drift_weights(target, returns, rebalance_days)
    return _evaluate(f"Parité de risque, rebalancée {rebalance_days}j",
                     weights, prices, cost_bps, **kw)


def volatility_targeted(prices: pd.DataFrame, cost_bps: float, lookback: int = 60,
                        rebalance_days: int = 21, target_vol: float = 0.10,
                        max_leverage: float = 2.0, **kw) -> AllocationResult:
    """Parité de risque, puis mise à l'échelle vers une volatilité cible.

    Le levier est calculé sur la volatilité *réalisée du portefeuille*, connue à
    la date de décision, et plafonné. C'est le seul endroit où l'on s'autorise
    un levier — et il est borné, précisément parce que l'estimation de
    volatilité est en retard sur les crises.
    """
    returns = prices.pct_change()
    vol = returns.rolling(lookback, min_periods=lookback // 2).std().shift(1)
    inverse = (1.0 / vol).replace([np.inf, -np.inf], np.nan)
    base = inverse.div(inverse.sum(axis=1), axis=0)

    portfolio_returns = (base.shift(1) * returns).sum(axis=1)
    realised = portfolio_returns.rolling(lookback, min_periods=lookback // 2).std().shift(1)
    leverage = (target_vol / (realised * np.sqrt(TRADING_DAYS))).clip(upper=max_leverage)

    target = base.mul(leverage, axis=0)
    weights = _drift_weights(target, returns, rebalance_days)
    return _evaluate(f"Vol ciblée {target_vol:.0%}, rebalancée {rebalance_days}j",
                     weights, prices, cost_bps, **kw)


def compare(prices: pd.DataFrame, cost_bps: float = 2.0,
            execution_lag: int = 1) -> pd.DataFrame:
    """Tableau comparatif des quatre approches, à univers et coûts identiques."""
    strategies = [
        buy_and_hold(prices, cost_bps, execution_lag=execution_lag),
        equal_weight_rebalanced(prices, cost_bps, execution_lag=execution_lag),
        risk_parity(prices, cost_bps, execution_lag=execution_lag),
        volatility_targeted(prices, cost_bps, execution_lag=execution_lag),
    ]
    return pd.DataFrame([s.row() for s in strategies]).set_index("stratégie")


def lag_robustness(prices: pd.DataFrame, cost_bps: float = 2.0,
                   lags: tuple[int, ...] = (1, 2, 3, 5)) -> pd.DataFrame:
    """Le résultat dépend-il du print de clôture ?

    Une stratégie d'allocation ne prédit rien à l'échelle de la barre : son
    rendement ne doit donc **pas** bouger quand on décale l'exécution. C'est le
    contrôle qui a invalidé la stratégie directionnelle, et celui qu'une
    approche non prédictive doit passer sans effort.
    """
    rows = []
    for lag in lags:
        result = volatility_targeted(prices, cost_bps, execution_lag=lag)
        rows.append({"lag": lag, "annualisé": round(result.annualised, 4),
                     "sharpe": round(result.sharpe, 3)})
    table = pd.DataFrame(rows).set_index("lag")
    reference = table.loc[lags[0], "sharpe"]
    table.attrs["stable"] = bool(
        reference > 0 and (table["sharpe"] > 0.7 * reference).all()
    )
    return table
