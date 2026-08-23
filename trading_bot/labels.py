"""Définition de l'événement dont on estime la probabilité.

Règle unique et non négociable : un label vaut ``NaN`` dès que son horizon
dépasse la fin des données. Le bot d'origine écrivait
``np.where(price.shift(-1) > price, 1, 0)`` — sur la dernière barre,
``NaN > x`` vaut ``False``, donc la ligne était silencieusement étiquetée 0.
Un label inobservable doit être absent, pas faux.

Chaque fonction renvoie aussi la *date de résolution* de chaque label : la barre
à laquelle l'événement est connu. C'est elle qui pilote la purge dans
:mod:`trading_bot.model` — sans elle on ne peut pas savoir quels échantillons
d'entraînement chevauchent la fenêtre de test.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from .config import LabelConfig


def average_true_range(df: pd.DataFrame, window: int) -> pd.Series:
    """ATR de Wilder, connu à la clôture de ``t`` (aucune donnée future)."""
    high, low, close = df["high"], df["low"], df["close"]
    prev_close = close.shift(1)
    true_range = pd.concat(
        [high - low, (high - prev_close).abs(), (low - prev_close).abs()], axis=1
    ).max(axis=1)
    return true_range.ewm(alpha=1.0 / window, adjust=False, min_periods=window).mean()


def _resolution_index(index: pd.Index, offsets: np.ndarray) -> pd.Series:
    """Convertit des décalages entiers en dates, ``NaT`` hors des bornes."""
    positions = np.arange(len(index)) + offsets
    valid = np.isfinite(offsets) & (positions < len(index))
    out = pd.Series(pd.NaT, index=index, name="resolution")
    safe = positions[valid].astype(int)
    out.iloc[np.flatnonzero(valid)] = index[safe]
    return out


def direction(df: pd.DataFrame, horizon: int) -> tuple[pd.Series, pd.Series]:
    """P(clôture t+h > clôture t).

    Le cas le plus dur : sur du FX quotidien le taux de base est ~50 % et l'edge
    exploitable se compte en fractions de point. À utiliser en sachant que la
    baseline « toujours le taux de base » est très difficile à battre.
    """
    close = df["close"]
    future = close.shift(-horizon)
    y = pd.Series(np.where(future > close, 1.0, 0.0), index=df.index, name="y")
    y[future.isna()] = np.nan  # horizon non observé => label absent, pas 0
    offsets = np.full(len(df), float(horizon))
    return y, _resolution_index(df.index, offsets)


def amplitude(df: pd.DataFrame, cfg: LabelConfig) -> tuple[pd.Series, pd.Series]:
    """P(|variation| > k×ATR sur les h prochaines barres), sans direction.

    La volatilité est fortement autocorrélée (clustering de volatilité), ce qui
    rend cet événement bien plus prédictible que la direction. Le seuil est
    exprimé en ATR *connu à t*, donc comparable à travers les régimes.
    """
    close = df["close"]
    h = cfg.horizon

    # Extrême du chemin futur sur (t, t+h], en excluant la barre t elle-même.
    fut_high = df["high"].shift(-1).rolling(h, min_periods=h).max().shift(-(h - 1))
    fut_low = df["low"].shift(-1).rolling(h, min_periods=h).min().shift(-(h - 1))
    excursion = pd.concat([(fut_high - close).abs(), (fut_low - close).abs()], axis=1).max(axis=1)

    if cfg.threshold_mode == "pct":
        # Seuil absolu : « un mouvement de plus de X % ». C'est la formulation
        # qui laisse le clustering de volatilité s'exprimer.
        threshold = pd.Series(cfg.barrier_pct * close, index=df.index)
    else:
        # Seuil relatif à l'ATR : comparable entre actifs, mais il normalise par
        # la volatilité courante et neutralise donc l'essentiel du signal.
        threshold = cfg.barrier_atr * average_true_range(df, cfg.reference_window)

    y = pd.Series(np.where(excursion > threshold, 1.0, 0.0), index=df.index, name="y")
    y[excursion.isna() | threshold.isna()] = np.nan
    offsets = np.full(len(df), float(h))
    return y, _resolution_index(df.index, offsets)


def triple_barrier(df: pd.DataFrame, cfg: LabelConfig) -> tuple[pd.Series, pd.Series]:
    """P(barrière haute touchée avant la barrière basse), horizon h.

    C'est l'étiquetage de López de Prado : il correspond exactement à un trade
    avec take-profit et stop-loss, donc la probabilité produite est directement
    actionnable. Les barrières sont posées à ±k×ATR connu à t.

    La date de résolution est ici *variable* — un trade peut se dénouer en 2
    barres comme en 10 — et c'est précisément pourquoi la purge doit s'appuyer
    dessus plutôt que sur un horizon fixe.
    """
    close = df["close"].to_numpy(dtype=float)
    high = df["high"].to_numpy(dtype=float)
    low = df["low"].to_numpy(dtype=float)
    atr = average_true_range(df, cfg.atr_window).to_numpy(dtype=float)
    n, h = len(df), cfg.horizon

    y = np.full(n, np.nan)
    offsets = np.full(n, np.nan)

    for t in range(n):
        if not np.isfinite(atr[t]) or t + h >= n:
            continue  # horizon incomplet => label absent
        upper = close[t] + cfg.barrier_atr * atr[t]
        lower = close[t] - cfg.barrier_atr * atr[t]
        hit = None
        for k in range(t + 1, t + h + 1):
            up_touched = high[k] >= upper
            down_touched = low[k] <= lower
            if up_touched and down_touched:
                # Les deux dans la même barre : sans données intra-barre on ne
                # peut pas trancher. Compter cela comme un gain serait le biais
                # optimiste classique — on retire l'échantillon.
                hit = (np.nan, k)
                break
            if up_touched:
                hit = (1.0, k)
                break
            if down_touched:
                hit = (0.0, k)
                break
        if hit is not None:
            y[t], offsets[t] = hit[0], float(hit[1] - t)
        elif cfg.unresolved == "sign":
            y[t] = 1.0 if close[t + h] > close[t] else 0.0
            offsets[t] = float(h)
        # unresolved == "drop" : on laisse NaN

    series = pd.Series(y, index=df.index, name="y")
    return series, _resolution_index(df.index, offsets)


def build(df: pd.DataFrame, cfg: LabelConfig) -> tuple[pd.Series, pd.Series]:
    """Dispatch sur ``cfg.kind``. Renvoie ``(labels, dates de résolution)``."""
    if cfg.kind == "direction":
        return direction(df, cfg.horizon)
    if cfg.kind == "amplitude":
        return amplitude(df, cfg)
    if cfg.kind == "triple_barrier":
        return triple_barrier(df, cfg)
    raise ValueError(f"Événement inconnu : {cfg.kind!r}")


def describe(cfg: LabelConfig) -> str:
    if cfg.kind == "direction":
        return f"P(clôture t+{cfg.horizon} > clôture t)"
    if cfg.kind == "amplitude":
        seuil = (f"{cfg.barrier_pct:.2%}" if cfg.threshold_mode == "pct"
                 else f"{cfg.barrier_atr}×ATR")
        return f"P(|variation| > {seuil} sur {cfg.horizon} barres)"
    return f"P(+{cfg.barrier_atr}×ATR avant −{cfg.barrier_atr}×ATR sous {cfg.horizon} barres)"
