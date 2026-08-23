"""Prévision de volatilité, et son usage : dimensionner mieux.

Le seul signal de ce projet qui ait résisté à tous les contrôles est la
**volatilité** — AUC 0.816 sur l'événement « gros mouvement à 5 jours », stable
jusqu'à 5 barres de décalage. Reste à en faire quelque chose.

On ne peut pas le trader directionnellement : il ne dit rien du sens. Le
véhicule naturel serait un straddle, mais cela demande des données d'options.

Il existe pourtant un usage immédiat et entièrement testable. Le mode
``allocation`` cible une volatilité en divisant par la volatilité **réalisée
passée** — un estimateur rétrospectif, structurellement en retard sur les
changements de régime : il désendette *après* le krach et se réendette *après*
le rebond. C'est exactement ce qui a coûté cher en 2020-2021.

Si un modèle prévoit la volatilité future mieux qu'une simple fenêtre glissante,
alors le remplacer améliore le dimensionnement — sans rien prédire de la
direction. Ce module mesure d'abord la qualité de la prévision, puis son effet
réel sur le portefeuille.

La cible est ``log(volatilité réalisée future)`` : le log parce que la
volatilité est log-normale et strictement positive, ce qui rend l'erreur
homogène entre régimes calmes et agités.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

import numpy as np
import pandas as pd
from sklearn.linear_model import Ridge
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from . import features as features_module
from .config import Config

logger = logging.getLogger(__name__)
TRADING_DAYS = 252


def realised_volatility(prices: pd.Series, horizon: int) -> pd.Series:
    """Volatilité annualisée réalisée sur les ``horizon`` barres **suivantes**.

    C'est la cible : elle est par construction inconnue en ``t``. Les dernières
    barres valent ``NaN`` et doivent être exclues, jamais comblées.
    """
    returns = np.log(prices).diff()
    future = returns.shift(-horizon).rolling(horizon, min_periods=horizon).std()
    return future.shift(-(horizon - 1) + (horizon - 1)) * np.sqrt(TRADING_DAYS)


@dataclass
class ForecastResult:
    predictions: pd.DataFrame        # date, symbol, prédit, baseline, réalisé
    r2_model: float
    r2_baseline: float
    mae_model: float
    mae_baseline: float
    per_fold: pd.DataFrame

    @property
    def beats_baseline(self) -> bool:
        return self.r2_model > self.r2_baseline and self.mae_model < self.mae_baseline

    def to_text(self) -> str:
        verdict = ("La prévision bat la fenêtre glissante"
                   if self.beats_baseline else "La fenêtre glissante fait aussi bien")
        return "\n".join([
            f"{'R² modèle':<16}{self.r2_model:>9.4f}   "
            f"(baseline {self.r2_baseline:.4f})",
            f"{'MAE modèle':<16}{self.mae_model:>9.4f}   "
            f"(baseline {self.mae_baseline:.4f})",
            "",
            f">>> {verdict}",
            "",
            self.per_fold.to_string(index=False),
        ])


def build_panel(symbols: list[str], cfg: Config, horizon: int = 21,
                trailing: int = 60) -> pd.DataFrame:
    """Panel long : features causales, cible future, et baseline rétrospective.

    La baseline est **exactement** ce que ``allocation.volatility_targeted``
    utilise aujourd'hui — la volatilité réalisée sur ``trailing`` barres,
    décalée d'une barre. C'est elle qu'il faut battre pour que l'exercice ait
    un sens.
    """
    from . import data as data_module

    blocks = []
    for symbol in symbols:
        try:
            frame = data_module.load(
                type(cfg.data)(**{**cfg.data.__dict__, "symbol": symbol})
            )
        except Exception as exc:
            logger.warning("%s ignoré : %s", symbol, exc)
            continue

        X = features_module.build(frame, include_slow=False)
        X = features_module.rolling_rank(X, cfg.model.rank_window)

        close = frame["close"].astype(float)
        returns = np.log(close).diff()
        target = returns.shift(-horizon).rolling(horizon, min_periods=horizon).std()
        target = target * np.sqrt(TRADING_DAYS)
        # `shift(-horizon).rolling(horizon)` cadre la fenêtre sur (t, t+horizon].
        baseline = returns.rolling(trailing, min_periods=trailing // 2).std().shift(1)
        baseline = baseline * np.sqrt(TRADING_DAYS)

        usable = target.notna() & baseline.notna() & (target > 0) & (baseline > 0)
        usable &= X.notna().all(axis=1)
        if usable.sum() < 500:
            continue

        block = X[usable].copy()
        block["y"] = np.log(target[usable])
        block["baseline"] = np.log(baseline[usable])
        block["symbol"] = symbol
        block["date"] = block.index
        block["horizon_end"] = block.index + pd.Timedelta(days=int(horizon * 1.5))
        blocks.append(block.reset_index(drop=True))

    if not blocks:
        raise ValueError("Aucun actif exploitable.")
    return pd.concat(blocks, ignore_index=True).sort_values(["date", "symbol"])


def walk_forward(panel: pd.DataFrame, feature_names: list[str], cfg: Config,
                 n_splits: int = 6, min_train: int = 1200,
                 embargo_days: int = 30) -> ForecastResult:
    """Walk-forward purgé, découpé par date, sur une cible continue.

    L'embargo est plus long ici que pour la classification : la cible chevauche
    ``horizon`` barres, et un embargo trop court laisserait le train voir la
    volatilité de la période testée.
    """
    dates = pd.DatetimeIndex(panel["date"].unique()).sort_values()
    min_dates = min(min_train, len(dates) // 2)
    span = (len(dates) - min_dates) // n_splits

    X = panel[feature_names].to_numpy(dtype=float)
    y = panel["y"].to_numpy(dtype=float)
    base = panel["baseline"].to_numpy(dtype=float)

    rows, fold_stats = [], []
    for k in range(n_splits):
        start = min_dates + k * span
        stop = start + span if k < n_splits - 1 else len(dates)
        t0, t1 = dates[start], dates[stop - 1]

        cutoff = t0 - pd.Timedelta(days=embargo_days)
        train = np.flatnonzero((panel["horizon_end"] < cutoff).to_numpy())
        test = np.flatnonzero(((panel["date"] >= t0) & (panel["date"] <= t1)).to_numpy())
        if len(train) < 500 or not len(test):
            continue

        # Ridge : la cible est continue et les features en rang sont corrélées.
        # Une régularisation forte est le bon réflexe quand on cherche un gain
        # marginal sur une baseline déjà solide.
        # On prédit la **correction** à la baseline, pas le niveau brut.
        #
        # Les features sont en rang percentile : elles portent une position
        # relative, pas une échelle. Leur demander de reconstruire le niveau de
        # volatilité revient à leur demander une information qu'elles ont
        # justement été conçues pour effacer — d'où un R² négatif contre une
        # baseline à 0.49. En cible, le résidu ``log(vol future / vol passée)``
        # est exactement ce que les features peuvent porter : une expansion ou
        # une contraction de régime.
        estimator = Pipeline([("scale", StandardScaler()), ("reg", Ridge(alpha=10.0))])
        estimator.fit(X[train], y[train] - base[train])
        predicted = base[test] + estimator.predict(X[test])

        rows.append(pd.DataFrame({
            "date": panel["date"].to_numpy()[test],
            "symbol": panel["symbol"].to_numpy()[test],
            "predicted": predicted, "baseline": base[test], "realised": y[test],
            "fold": k,
        }))
        ss_tot = float(((y[test] - y[test].mean()) ** 2).sum())
        fold_stats.append({
            "fold": k, "n": len(test),
            "r2_modele": round(1 - float(((y[test] - predicted) ** 2).sum()) / ss_tot, 4),
            "r2_baseline": round(1 - float(((y[test] - base[test]) ** 2).sum()) / ss_tot, 4),
        })

    if not rows:
        raise RuntimeError("Aucun fold exploitable.")

    out = pd.concat(rows, ignore_index=True)
    realised = out["realised"].to_numpy()
    ss_tot = float(((realised - realised.mean()) ** 2).sum())
    return ForecastResult(
        predictions=out,
        r2_model=1 - float(((realised - out["predicted"]) ** 2).sum()) / ss_tot,
        r2_baseline=1 - float(((realised - out["baseline"]) ** 2).sum()) / ss_tot,
        mae_model=float((realised - out["predicted"]).abs().mean()),
        mae_baseline=float((realised - out["baseline"]).abs().mean()),
        per_fold=pd.DataFrame(fold_stats),
    )


def predicted_volatility_frame(result: ForecastResult) -> pd.DataFrame:
    """Prévisions en table date × actif, en volatilité (pas en log)."""
    wide = result.predictions.pivot_table(
        index="date", columns="symbol", values="predicted", aggfunc="last"
    )
    return np.exp(wide).sort_index()


def allocate_with_forecast(prices: pd.DataFrame, predicted: pd.DataFrame,
                           cost_bps: float = 2.0, rebalance_days: int = 21,
                           target_vol: float = 0.10, max_leverage: float = 2.0,
                           execution_lag: int = 1, use_forecast: bool = True,
                           trailing: int = 60) -> "object":
    """Même stratégie que ``allocation.volatility_targeted``, deux estimateurs.

    ``use_forecast=False`` reproduit exactement la version actuelle (volatilité
    réalisée passée) ; ``True`` la remplace par la prévision. Tout le reste est
    identique, de sorte que l'écart mesuré n'attribue rien d'autre que le
    changement d'estimateur.

    Une meilleure prévision n'a d'intérêt que si elle améliore le résultat : un
    R² supérieur qui ne se traduit pas dans le portefeuille ne vaut rien.
    """
    from .allocation import _drift_weights, _evaluate

    common = prices.index.intersection(predicted.index)
    prices = prices.loc[common]
    returns = prices.pct_change()

    if use_forecast:
        # La prévision porte sur (t, t+h] : elle est connue en t, donc utilisable
        # sans décalage supplémentaire. On reporte en avant entre deux dates de
        # prédiction, jamais en arrière.
        vol = predicted.reindex(columns=prices.columns).reindex(common).ffill()
    else:
        vol = returns.rolling(trailing, min_periods=trailing // 2).std().shift(1)
        vol = vol * np.sqrt(TRADING_DAYS)

    inverse = (1.0 / vol).replace([np.inf, -np.inf], np.nan)
    base = inverse.div(inverse.sum(axis=1), axis=0)

    portfolio_vol = (base * vol).sum(axis=1)          # vol attendue du portefeuille
    leverage = (target_vol / portfolio_vol).clip(upper=max_leverage)

    target = base.mul(leverage, axis=0)
    weights = _drift_weights(target, returns, rebalance_days)
    label = "Vol PRÉVUE" if use_forecast else "Vol passée (référence)"
    return _evaluate(f"{label}, cible {target_vol:.0%}", weights, prices, cost_bps,
                     execution_lag=execution_lag)
