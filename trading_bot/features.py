"""Features stationnaires et strictement causales.

Deux principes, qui suffisent à écarter la quasi-totalité des features du bot
d'origine :

1. **Stationnarité.** Le prix brut dérive : ce qu'un modèle apprend sur un
   EUR/USD à 1.35 ne vaut plus rien à 1.05. On ne garde que des grandeurs
   normalisées — rendements, z-scores, ratios, positions relatives.
2. **Causalité.** Toute fenêtre est glissante et arrêtée à ``t``. Les métriques
   de chaos (Hurst, entropie) sont ici recalculées à chaque barre sur la fenêtre
   passée, au lieu d'être évaluées une fois sur toute la série et recopiées sur
   chaque ligne — ce qui les rendait constantes *et* rétrospectives.

Corollaire volontairement absent : ``log(price)``, ``sqrt(price)``,
``price**3``. Ce sont des transformations monotones du prix, auxquelles tout
modèle à base d'arbres est invariant — mêmes découpes, zéro information, mais du
bruit dimensionnel en plus et un double comptage de la même évidence.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from .labels import average_true_range

RETURN_HORIZONS = (1, 2, 5, 10, 20)
VOL_WINDOWS = (10, 20)
TREND_WINDOWS = (10, 20, 50)


def _rolling_hurst_rs(series: pd.Series, window: int = 64) -> pd.Series:
    """Exposant de Hurst par analyse R/S, en fenêtre glissante.

    >0.5 : série persistante (tendance). <0.5 : anti-persistante (retour à la
    moyenne). Calculé sur les rendements de la fenêtre ``[t-window, t]`` — donc
    utilisable en t, contrairement à un ``nolds.hurst_rs`` sur la série entière.
    """

    def rs_exponent(x: np.ndarray) -> float:
        x = x[np.isfinite(x)]
        n = len(x)
        if n < 16:
            return np.nan
        sizes = np.unique(np.floor(np.logspace(np.log10(8), np.log10(n), 5)).astype(int))
        sizes = sizes[sizes >= 8]
        if len(sizes) < 2:
            return np.nan
        logs = []
        for size in sizes:
            chunks = n // size
            ratios = []
            for c in range(chunks):
                seg = x[c * size : (c + 1) * size]
                dev = np.cumsum(seg - seg.mean())
                spread = dev.max() - dev.min()
                sigma = seg.std()
                if sigma > 0 and spread > 0:
                    ratios.append(spread / sigma)
            if ratios:
                logs.append((np.log(size), np.log(np.mean(ratios))))
        if len(logs) < 2:
            return np.nan
        xs, ys = np.array(logs).T
        return float(np.polyfit(xs, ys, 1)[0])

    return series.rolling(window, min_periods=window).apply(rs_exponent, raw=True)


def _rolling_entropy(series: pd.Series, window: int = 32, bins: int = 8) -> pd.Series:
    """Entropie de Shannon des rendements de la fenêtre, normalisée dans [0, 1].

    Proche de 1 : régime désordonné. Proche de 0 : rendements concentrés, régime
    directionnel ou très calme.
    """

    def shannon(x: np.ndarray) -> float:
        x = x[np.isfinite(x)]
        if len(x) < bins:
            return np.nan
        counts, _ = np.histogram(x, bins=bins)
        p = counts[counts > 0] / counts.sum()
        return float(-(p * np.log(p)).sum() / np.log(bins))

    return series.rolling(window, min_periods=window).apply(shannon, raw=True)


def build(df: pd.DataFrame, include_slow: bool = True) -> pd.DataFrame:
    """Construit la matrice de features à partir d'un OHLCV indexé par date.

    ``include_slow=False`` désactive Hurst et l'entropie (coûteux en ``apply``),
    utile pour les tests et les itérations rapides.
    """
    out = pd.DataFrame(index=df.index)
    close, high, low = df["close"], df["high"], df["low"]
    log_close = np.log(close)
    ret1 = log_close.diff()

    # --- Momentum : rendements log sur plusieurs horizons ---------------------
    for h in RETURN_HORIZONS:
        out[f"ret_{h}"] = log_close.diff(h)

    # --- Volatilité : niveau et régime ---------------------------------------
    for w in VOL_WINDOWS:
        vol = ret1.rolling(w, min_periods=w).std()
        out[f"vol_{w}"] = vol
        # Ratio de volatilité court/long : capte l'expansion de régime, qui est
        # la grandeur réellement prédictible sur les marchés.
        out[f"vol_ratio_{w}"] = vol / ret1.rolling(w * 4, min_periods=w * 4).std()

    atr = average_true_range(df, 14)
    out["atr_rel"] = atr / close
    out["range_rel"] = (high - low) / close

    # --- Rendements normalisés par la volatilité (comparables entre régimes) --
    vol20 = ret1.rolling(20, min_periods=20).std()
    out["ret_1_z"] = ret1 / vol20
    out["ret_5_z"] = log_close.diff(5) / (vol20 * np.sqrt(5))

    # --- Tendance : écart relatif aux moyennes mobiles ------------------------
    for w in TREND_WINDOWS:
        sma = close.rolling(w, min_periods=w).mean()
        out[f"dist_sma_{w}"] = close / sma - 1.0
    ema12 = close.ewm(span=12, adjust=False).mean()
    ema26 = close.ewm(span=26, adjust=False).mean()
    macd = ema12 - ema26
    # Normalisé par le prix : sans cela le MACD n'est pas comparable dans le temps.
    out["macd_rel"] = macd / close
    out["macd_hist_rel"] = (macd - macd.ewm(span=9, adjust=False).mean()) / close

    # --- Oscillateurs, centrés sur 0 -----------------------------------------
    delta = close.diff()
    gain = delta.clip(lower=0).ewm(alpha=1 / 14, adjust=False, min_periods=14).mean()
    loss = (-delta.clip(upper=0)).ewm(alpha=1 / 14, adjust=False, min_periods=14).mean()
    rsi = 100 - 100 / (1 + gain / loss.replace(0, np.nan))
    out["rsi_centered"] = (rsi - 50) / 50

    sma20 = close.rolling(20, min_periods=20).mean()
    std20 = close.rolling(20, min_periods=20).std()
    out["bb_position"] = (close - sma20) / (2 * std20)   # %B recentré sur 0
    out["bb_width"] = (4 * std20) / sma20               # largeur = proxy de vol

    # --- Position dans l'intervalle récent -----------------------------------
    for w in (20, 60):
        roll_max = high.rolling(w, min_periods=w).max()
        roll_min = low.rolling(w, min_periods=w).min()
        span = (roll_max - roll_min).replace(0, np.nan)
        out[f"channel_pos_{w}"] = (close - roll_min) / span - 0.5

    # --- Forme de la distribution des rendements -----------------------------
    out["skew_20"] = ret1.rolling(20, min_periods=20).skew()
    out["kurt_20"] = ret1.rolling(20, min_periods=20).kurt()
    out["autocorr_20"] = ret1.rolling(20, min_periods=20).apply(
        lambda x: pd.Series(x).autocorr(lag=1), raw=False
    )

    # --- Volume, seulement s'il existe vraiment ------------------------------
    # Twelve Data ne fournit pas de volume sur le FX : la colonne serait
    # constamment nulle et n'apporterait qu'un axe de bruit.
    if "volume" in df and df["volume"].fillna(0).abs().sum() > 0:
        vol_series = df["volume"].astype(float)
        mean = vol_series.rolling(20, min_periods=20).mean()
        std = vol_series.rolling(20, min_periods=20).std().replace(0, np.nan)
        out["volume_z"] = (vol_series - mean) / std

    # --- Régime : métriques de complexité, en fenêtre glissante --------------
    if include_slow:
        out["hurst_64"] = _rolling_hurst_rs(ret1, 64)
        out["entropy_32"] = _rolling_entropy(ret1, 32)

    # --- Saisonnalité hebdomadaire -------------------------------------------
    if isinstance(df.index, pd.DatetimeIndex):
        dow = df.index.dayofweek.to_numpy()
        out["dow_sin"] = np.sin(2 * np.pi * dow / 5)
        out["dow_cos"] = np.cos(2 * np.pi * dow / 5)

    return out.replace([np.inf, -np.inf], np.nan)


def rolling_rank(X: pd.DataFrame, window: int = 250, min_periods: int = 60) -> pd.DataFrame:
    """Remplace chaque feature par son rang percentile dans sa fenêtre passée.

    C'est la parade à un mode d'échec très concret des modèles à base d'arbres :
    quand le régime de test sort du support d'entraînement — une volatilité
    jamais vue pendant le train — un arbre ne peut pas extrapoler, il prédit une
    constante, et le classement bascule sur des features de bruit. Mesuré sur la
    série synthétique : dans le fold où la volatilité médiane double, l'AUC du
    modèle tombe à 0.21 (inversion complète) alors que la feature brute
    ``vol_10`` vaut 0.84 sur ce même fold.

    Le rang percentile ramène chaque feature dans [0, 1] par construction. Il est
    strictement causal — le rang est celui de la barre courante *dans sa propre
    fenêtre passée* — et il conserve l'ordre, donc toute l'information
    monotone qu'un arbre sait exploiter.
    """
    ranked = X.rolling(window, min_periods=min_periods).rank(pct=True)
    ranked.columns = [f"{c}_rank" for c in X.columns]
    return ranked
