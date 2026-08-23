"""Entraînement mutualisé sur plusieurs actifs.

Le constat qui motive ce module : sur un actif seul, en quotidien, le signal
directionnel est indiscernable du bruit. Ce n'est pas un défaut de modèle, c'est
un problème de **rapport signal/bruit par pari**. Deux leviers existent, et un
seul est à notre portée :

1. Augmenter l'edge par pari — c'est ce que tout le monde essaie, et c'est ce
   qui échoue sur EUR/USD quotidien.
2. **Augmenter le nombre de paris indépendants.** Un edge minuscule répété sur
   10 actifs peu corrélés produit un Sharpe que le même edge sur un seul actif
   ne produira jamais. C'est la « loi fondamentale de la gestion active » de
   Grinold : ``IR ≈ IC × √breadth``.

D'où ce module. Un **seul** modèle est entraîné sur tous les actifs empilés :
13× plus de données, et surtout il ne peut plus mémoriser une série
particulière — il doit apprendre une relation qui vaut d'un actif à l'autre.
Les features étant transformées en rang glissant *par actif*, elles sont
directement comparables entre un taux de change et le pétrole.

Le découpage temporel est fait **par date**, jamais par ligne : à une date
donnée, tous les actifs sont du même côté de la frontière train/test.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

import numpy as np
import pandas as pd

from . import data as data_module
from . import evaluate, features, labels, model
from .config import BacktestConfig, Config

logger = logging.getLogger(__name__)


@dataclass
class Panel:
    """Données empilées : une ligne = (date, actif)."""

    frame: pd.DataFrame          # colonnes : symbol, y, resolution + features
    feature_names: list[str]
    prices: dict[str, pd.DataFrame]

    @property
    def dates(self) -> pd.DatetimeIndex:
        return pd.DatetimeIndex(self.frame["date"].unique()).sort_values()


def build_panel(symbols: list[str], cfg: Config, include_slow: bool = True) -> Panel:
    """Construit le panel en calculant features et labels **actif par actif**.

    L'ordre compte : normaliser après empilement mélangerait les échelles de
    l'or et de l'euro. Chaque actif est traité isolément, puis empilé.
    """
    blocks, prices, names = [], {}, None

    for symbol in symbols:
        try:
            frame = data_module.load(
                type(cfg.data)(**{**cfg.data.__dict__, "symbol": symbol})
            )
        except Exception as exc:
            logger.warning("%s ignoré : %s", symbol, exc)
            continue

        X = features.build(frame, include_slow=include_slow)
        if cfg.model.feature_transform == "rank":
            X = features.rolling_rank(X, cfg.model.rank_window)
        y, resolution = labels.build(frame, cfg.label)

        usable = y.notna() & X.notna().all(axis=1) & resolution.notna()
        if usable.sum() < 500:
            logger.warning("%s ignoré : %d lignes exploitables", symbol, int(usable.sum()))
            continue

        block = X[usable].copy()
        names = list(block.columns)
        block["y"] = y[usable]
        block["resolution"] = resolution[usable]
        block["symbol"] = symbol
        block["date"] = block.index
        block["baseline"] = model.rolling_baseline(
            y[usable], cfg.label.horizon, cfg.split.baseline_window
        )
        blocks.append(block.reset_index(drop=True))
        prices[symbol] = frame
        logger.info("%s : %d lignes, taux de base %.3f", symbol, len(block), block["y"].mean())

    if not blocks:
        raise ValueError("Aucun actif exploitable.")

    panel = pd.concat(blocks, ignore_index=True).sort_values(["date", "symbol"])
    panel["baseline"] = panel["baseline"].fillna(panel["y"].mean())
    return Panel(panel.reset_index(drop=True), names, prices)


def walk_forward(panel: Panel, cfg: Config) -> pd.DataFrame:
    """Walk-forward purgé, découpé par **date** et non par ligne."""
    frame = panel.frame
    dates = panel.dates
    n_dates = len(dates)

    # La fenêtre minimale est exprimée en barres d'un actif : on la convertit en
    # nombre de dates, sinon 10 actifs la satureraient dix fois trop vite.
    min_dates = min(cfg.split.min_train_size, n_dates // 2)
    test_span = (n_dates - min_dates) // cfg.split.n_splits
    if test_span <= 0:
        raise ValueError("Historique trop court pour ce découpage.")

    rows = []
    for k in range(cfg.split.n_splits):
        start = min_dates + k * test_span
        stop = start + test_span if k < cfg.split.n_splits - 1 else n_dates
        test_start, test_stop = dates[start], dates[stop - 1]

        # Purge : on retire tout échantillon dont le *label* se résout après le
        # début du test, embargo compris. Sur un panel c'est indispensable — un
        # label à 21 jours chevauche trois semaines de la période testée.
        cutoff = test_start - pd.Timedelta(days=cfg.split.embargo)
        is_train = frame["resolution"] < cutoff
        is_test = (frame["date"] >= test_start) & (frame["date"] <= test_stop)

        train_idx = np.flatnonzero(is_train.to_numpy())
        test_idx = np.flatnonzero(is_test.to_numpy())
        if len(train_idx) < 500 or len(test_idx) == 0:
            continue

        # Tranche de calibration : la fin du train, donc la plus proche du test.
        n_calib = max(200, int(len(train_idx) * cfg.split.calibration_fraction))
        n_calib = min(n_calib, len(train_idx) // 2)
        fit_idx, calib_idx = train_idx[:-n_calib], train_idx[-n_calib:]

        X = frame[panel.feature_names].to_numpy(dtype=float)
        y = frame["y"].to_numpy(dtype=float)
        if len(np.unique(y[fit_idx])) < 2:
            continue

        estimator = model.build_estimator(cfg.model)
        estimator.fit(X[fit_idx], y[fit_idx])

        calib_scores = estimator.predict_proba(X[calib_idx])[:, 1]
        calibrator = model.Calibrator(cfg.model.calibration, cfg.model.calibration_reg)
        calibrator.fit(calib_scores, y[calib_idx])
        p_test = calibrator.transform(estimator.predict_proba(X[test_idx])[:, 1])

        baseline = frame["baseline"].to_numpy(dtype=float)[test_idx]
        if cfg.model.prior == "adaptive":
            evidence = model.Calibrator._logit(p_test) - float(
                np.mean(model.Calibrator._logit(calibrator.transform(calib_scores)))
            )
            evidence *= cfg.model.evidence_weight
            p_test = 1.0 / (1.0 + np.exp(-(model.Calibrator._logit(baseline) + evidence)))

        rows.append(
            pd.DataFrame(
                {
                    "date": frame["date"].to_numpy()[test_idx],
                    "symbol": frame["symbol"].to_numpy()[test_idx],
                    "p": p_test,
                    "baseline": baseline,
                    "y": y[test_idx],
                    "fold": k,
                }
            )
        )
        logger.info("Fold %d — train=%d calib=%d test=%d (%s -> %s)",
                    k, len(fit_idx), len(calib_idx), len(test_idx),
                    test_start.date(), test_stop.date())

    if not rows:
        raise RuntimeError("Aucun fold exploitable.")
    return pd.concat(rows, ignore_index=True).sort_values(["date", "symbol"])


# --------------------------------------------------------------------------- #
# Backtest de portefeuille
# --------------------------------------------------------------------------- #
@dataclass(frozen=True)
class PortfolioResult:
    n_days: int
    n_assets: int
    total_return: float
    annualised: float
    sharpe: float
    max_drawdown: float
    hit_rate: float
    exposure: float
    total_costs: float
    total_carry: float
    final_balance: float
    equity: pd.Series
    per_asset: pd.DataFrame

    def to_text(self) -> str:
        lines = [
            f"{'Jours':<18}: {self.n_days}",
            f"{'Actifs':<18}: {self.n_assets}",
            f"{'Rendement total':<18}: {self.total_return:+.2%}",
            f"{'Annualisé':<18}: {self.annualised:+.2%}",
            f"{'Sharpe':<18}: {self.sharpe:+.3f}",
            f"{'Drawdown max':<18}: {self.max_drawdown:.2%}",
            f"{'Taux de réussite':<18}: {self.hit_rate:.2%}",
            f"{'Exposition moyenne':<18}: {self.exposure:.2%}",
            f"{'Coûts exécution':<18}: {self.total_costs:.2%}",
            f"{'Financement':<18}: {self.total_carry:+.2%}"
            + ("" if self.total_carry else "   (non modélisé)"),
            f"{'Capital final':<18}: {self.final_balance:,.0f}",
            "",
            "Contribution par actif :",
            self.per_asset.to_string(),
        ]
        return "\n".join(lines)


def portfolio_backtest(
    panel: Panel, predictions: pd.DataFrame, cfg: Config, vol_target: float = 0.10,
    rates: pd.DataFrame | None = None,
) -> PortfolioResult:
    """Portefeuille équipondéré en *risque*, pas en capital.

    Deux points qui font la différence entre un backtest crédible et un joli
    graphique :

    - **Parité de risque.** Pondérer à capital égal laisserait le Bitcoin, cinq
      fois plus volatil qu'EUR/USD, dicter la totalité du résultat. Chaque
      position est donc divisée par sa volatilité récente (connue à la date de
      décision) et visée à ``vol_target`` annualisé.
    - **Financement overnight.** Passer ``rates`` ajoute le portage réellement
      encouru : pour une paire BASE/QUOTE, une position longue perçoit
      ``taux_BASE − taux_QUOTE`` au prorata des jours calendaires écoulés, et
      une position courte le paie. C'était le dernier biais optimiste du
      backtest — avec une détention d'environ deux jours, il s'applique à
      presque chaque trade.
    - **La diversification est le produit fini.** L'intérêt de mutualiser n'est
      pas de mieux prédire chaque actif, c'est d'additionner des paris peu
      corrélés. Le tableau par actif montre qui porte réellement le résultat.
    """
    from .backtest import TRADING_DAYS, position_from_probability

    from . import rates as rates_module

    per_asset_returns, per_asset_stats, costs, carries = {}, [], {}, {}

    for symbol, group in predictions.groupby("symbol"):
        prices = panel.prices[symbol]
        close = prices["close"].astype(float)
        group = group.set_index("date").sort_index()

        raw_position = position_from_probability(group["p"], group["baseline"], cfg.backtest)

        # Volatilité connue à la date de décision : décalée d'une barre pour
        # qu'aucune information du jour même n'entre dans le dimensionnement.
        bar_return = close.pct_change()
        vol = bar_return.rolling(60, min_periods=30).std().shift(1) * np.sqrt(TRADING_DAYS)
        scale = (vol_target / vol).clip(upper=3.0)

        window = close.loc[group.index[0] :]
        position = (raw_position * scale.reindex(raw_position.index)).reindex(window.index)
        position = position.ffill().fillna(0.0).shift(cfg.backtest.execution_lag).fillna(0.0)

        turnover = position.diff().abs().fillna(position.abs())
        net = position * bar_return.reindex(window.index).fillna(0.0)
        net = net - turnover * (cfg.backtest.spread_bps / 10_000.0)

        # Financement : appliqué à la position effectivement détenue sur la même
        # période que le rendement, donc aucun décalage supplémentaire.
        if rates is not None:
            try:
                carry = position * rates_module.daily_carry(symbol, window.index, rates)
            except rates_module.RatesError as exc:
                logger.warning("%s : financement non appliqué (%s)", symbol, exc)
                carry = pd.Series(0.0, index=window.index)
        else:
            carry = pd.Series(0.0, index=window.index)

        net = net + carry
        costs[symbol] = turnover * (cfg.backtest.spread_bps / 10_000.0)
        carries[symbol] = carry
        per_asset_returns[symbol] = net
        per_asset_stats.append(
            {
                "symbole": symbol,
                "rendement": float((1 + net).prod() - 1),
                "sharpe": float(net.mean() / net.std() * np.sqrt(TRADING_DAYS))
                if net.std() > 0 else 0.0,
                "financement": float(carry.sum()),
                "exposition": float((position != 0).mean()),
            }
        )

    combined = pd.DataFrame(per_asset_returns).sort_index()
    # Équipondération : le portefeuille est la moyenne des actifs disponibles ce
    # jour-là, ce qui évite de sur-pondérer les périodes à faible couverture.
    portfolio = combined.mean(axis=1, skipna=True).fillna(0.0)

    equity = cfg.backtest.initial_balance * (1 + portfolio).cumprod()
    drawdown = equity / equity.cummax() - 1.0
    years = len(portfolio) / TRADING_DAYS
    traded = portfolio[portfolio != 0]

    stats = pd.DataFrame(per_asset_stats).set_index("symbole").round(4)
    return PortfolioResult(
        n_days=len(portfolio),
        n_assets=combined.shape[1],
        total_return=float(equity.iloc[-1] / cfg.backtest.initial_balance - 1),
        annualised=float((equity.iloc[-1] / cfg.backtest.initial_balance) ** (1 / years) - 1),
        sharpe=float(portfolio.mean() / portfolio.std() * np.sqrt(TRADING_DAYS))
        if portfolio.std() > 0 else 0.0,
        max_drawdown=float(drawdown.min()),
        hit_rate=float((traded > 0).mean()) if len(traded) else 0.0,
        exposure=float((combined.notna()).mean(axis=1).mean()),
        total_costs=float(pd.DataFrame(costs).mean(axis=1).sum()),
        total_carry=float(pd.DataFrame(carries).mean(axis=1).sum()),
        final_balance=float(equity.iloc[-1]),
        equity=equity,
        per_asset=stats.sort_values("sharpe", ascending=False),
    )


def lag_robustness(
    panel: Panel, predictions: pd.DataFrame, cfg: Config,
    lags: tuple[int, ...] = (1, 2, 3), rates: pd.DataFrame | None = None,
) -> pd.DataFrame:
    """Le résultat survit-il à une barre d'exécution supplémentaire ?

    **C'est le contrôle le plus important de tout le projet, et il est fatal.**

    Un prix de clôture n'est pas une valeur exacte : c'est un print entaché de
    bruit — rebond entre bid et ask, cotation périmée, horodatage flottant selon
    le fournisseur. Ce bruit crée une autocorrélation négative purement
    artificielle : quand la clôture enregistrée est trop basse par accident, la
    suivante « revient », et une stratégie de retour à la moyenne encaisse un
    profit qui n'existe que dans les données. On ne peut pas traiter à un prix
    erroné.

    Le test : décaler l'exécution d'une barre de plus. Un effet économique réel,
    qui se déploie sur plusieurs jours, en perd une partie. Un artefact de
    microstructure, lui, **disparaît intégralement** — tout son rendement est
    concentré sur le premier print après le signal.

    Mesuré sur ce dépôt, données Yahoo, panier FX : Sharpe +3.69 à lag=1,
    **−0.79 à lag=2**. Verdict sans appel — et confirmé par le fournisseur : la
    même paire EUR/USD affiche une autocorrélation lag-1 de −0.0240 chez Yahoo
    contre −0.0050 chez Alpha Vantage, pour des clôtures qui diffèrent de 9 pips
    en médiane.

    Règle de lecture : **si le Sharpe s'effondre entre lag=1 et lag=2, le
    résultat n'est pas tradable**, quelle que soit sa beauté.
    """
    rows = []
    for lag in lags:
        variant = Config(
            data=cfg.data, label=cfg.label, split=cfg.split, model=cfg.model,
            backtest=BacktestConfig(
                spread_bps=cfg.backtest.spread_bps,
                execution_lag=lag,
                edge_threshold=cfg.backtest.edge_threshold,
                max_position=cfg.backtest.max_position,
                initial_balance=cfg.backtest.initial_balance,
            ),
        )
        result = portfolio_backtest(panel, predictions, variant, rates=rates)
        rows.append({"lag": lag, "sharpe": round(result.sharpe, 3),
                     "annualisé": round(result.annualised, 4),
                     "rendement": round(result.total_return, 4)})

    table = pd.DataFrame(rows).set_index("lag")
    reference = table.loc[lags[0], "sharpe"]
    survivor = table.loc[lags[1], "sharpe"] if len(lags) > 1 else reference
    # Un effet réel conserve une fraction substantielle de son Sharpe ; un
    # artefact de microstructure passe en négatif ou s'annule.
    table.attrs["tradable"] = bool(reference > 0 and survivor > 0.5 * reference)
    return table
