"""Accès aux données OHLCV.

Trois sources : l'API Twelve Data (avec cache SQLite *expirant*), un CSV local,
et un générateur synthétique. Le générateur n'est pas un gadget : il produit une
série dont on connaît les propriétés (volatilité groupée, direction non
prédictible), ce qui permet de vérifier que le pipeline détecte le signal quand
il existe et ne l'invente pas quand il n'existe pas.

La clé API est lue dans l'environnement. Une clé écrite en dur dans le source
finit dans l'historique git, puis publiée.
"""

from __future__ import annotations

import logging
import os
import sqlite3
import time
from io import StringIO

import numpy as np
import pandas as pd
import requests

from .config import DataConfig

logger = logging.getLogger(__name__)

COLUMNS = ["open", "high", "low", "close", "volume"]


class DataError(RuntimeError):
    pass


# --------------------------------------------------------------------------- #
# Cache
# --------------------------------------------------------------------------- #
def _init_cache(path: str) -> sqlite3.Connection:
    conn = sqlite3.connect(path)
    conn.execute(
        """CREATE TABLE IF NOT EXISTS ohlcv (
               symbol TEXT, interval TEXT, outputsize INTEGER,
               fetched_at REAL, payload TEXT,
               PRIMARY KEY (symbol, interval, outputsize))"""
    )
    conn.commit()
    return conn


def _cache_read(conn: sqlite3.Connection, cfg: DataConfig) -> pd.DataFrame | None:
    row = conn.execute(
        "SELECT fetched_at, payload FROM ohlcv WHERE symbol=? AND interval=? AND outputsize=?",
        (cfg.symbol, cfg.interval, cfg.outputsize),
    ).fetchone()
    if row is None:
        return None
    age_hours = (time.time() - row[0]) / 3600.0
    if age_hours > cfg.cache_ttl_hours:
        logger.info("Cache expiré pour %s (%.1f h) — rafraîchissement", cfg.symbol, age_hours)
        return None
    logger.info("Cache utilisé pour %s (%.1f h)", cfg.symbol, age_hours)
    df = pd.read_json(StringIO(row[1]), orient="table")
    return df


def _cache_write(conn: sqlite3.Connection, cfg: DataConfig, df: pd.DataFrame) -> None:
    conn.execute(
        "INSERT OR REPLACE INTO ohlcv VALUES (?,?,?,?,?)",
        (cfg.symbol, cfg.interval, cfg.outputsize, time.time(), df.to_json(orient="table")),
    )
    conn.commit()


# --------------------------------------------------------------------------- #
# Providers
# --------------------------------------------------------------------------- #
def _fetch_twelvedata(cfg: DataConfig, max_attempts: int = 4) -> pd.DataFrame:
    if not cfg.api_key:
        raise DataError(
            f"Aucune clé API : exportez {cfg.api_key_env}, "
            "ou utilisez --provider synthetic / --provider csv."
        )
    url = "https://api.twelvedata.com/time_series"
    params = {
        "symbol": cfg.symbol,
        "interval": cfg.interval,
        "outputsize": cfg.outputsize,
        "apikey": cfg.api_key,
        "format": "JSON",
    }
    last_error: Exception | None = None
    for attempt in range(max_attempts):
        try:
            response = requests.get(url, params=params, timeout=30)
            response.raise_for_status()
            payload = response.json()
            if payload.get("status") == "error":
                # Erreur applicative (clé invalide, quota) : inutile de réessayer.
                raise DataError(f"Twelve Data: {payload.get('message')}")
            values = payload.get("values")
            if not values:
                raise DataError(f"Réponse sans données pour {cfg.symbol}: {payload}")
            return _normalise(pd.DataFrame(values))
        except DataError:
            raise
        except Exception as exc:  # réseau / HTTP / JSON
            last_error = exc
            wait = 2**attempt
            logger.warning("Tentative %d échouée (%s) — nouvel essai dans %ds", attempt + 1, exc, wait)
            time.sleep(wait)
    raise DataError(f"Récupération impossible pour {cfg.symbol}: {last_error}")


def _normalise(raw: pd.DataFrame) -> pd.DataFrame:
    df = raw.copy()
    df["datetime"] = pd.to_datetime(df["datetime"])
    df = df.set_index("datetime").sort_index()
    for col in COLUMNS:
        df[col] = pd.to_numeric(df[col], errors="coerce") if col in df else np.nan
    df = df[COLUMNS]
    # Une barre sans clôture n'est pas une barre.
    df = df[df["close"].notna()]
    df["high"] = df[["high", "close"]].max(axis=1)
    df["low"] = df[["low", "close"]].min(axis=1)
    df["open"] = df["open"].fillna(df["close"])
    df["volume"] = df["volume"].fillna(0.0)
    return df[~df.index.duplicated(keep="last")]


def _fetch_alphavantage(cfg: DataConfig, max_attempts: int = 4) -> pd.DataFrame:
    """FX quotidien depuis Alpha Vantage.

    Sans clé, la clé publique ``demo`` sert de repli : elle donne un historique
    complet sur les paires majeures, ce qui suffit pour valider un pipeline. Pour
    un usage régulier, exportez ``ALPHAVANTAGE_API_KEY`` (gratuite).
    """
    try:
        base, quote = cfg.symbol.replace("-", "/").split("/")
    except ValueError as exc:
        raise DataError(f"Symbole attendu sous la forme EUR/USD, reçu {cfg.symbol!r}") from exc

    params = {
        "function": "FX_DAILY",
        "from_symbol": base,
        "to_symbol": quote,
        "outputsize": "full",
        "apikey": os.environ.get("ALPHAVANTAGE_API_KEY", "demo"),
    }
    last_error: Exception | None = None
    for attempt in range(max_attempts):
        try:
            response = requests.get("https://www.alphavantage.co/query", params=params, timeout=45)
            response.raise_for_status()
            payload = response.json()
            series = payload.get("Time Series FX (Daily)")
            if not series:
                # L'API répond 200 même pour une limite de quota ou un symbole
                # inconnu : le message est dans le corps, pas dans le statut.
                reason = payload.get("Note") or payload.get("Error Message") or payload
                raise DataError(f"Alpha Vantage: {reason}")
            frame = pd.DataFrame(series).T.rename(
                columns={"1. open": "open", "2. high": "high",
                         "3. low": "low", "4. close": "close"}
            )
            frame.index.name = "datetime"
            return _normalise(frame.reset_index())
        except DataError:
            raise
        except Exception as exc:
            last_error = exc
            wait = 2**attempt
            logger.warning("Tentative %d échouée (%s) — nouvel essai dans %ds",
                           attempt + 1, exc, wait)
            time.sleep(wait)
    raise DataError(f"Récupération impossible pour {cfg.symbol}: {last_error}")


def _load_csv(cfg: DataConfig) -> pd.DataFrame:
    if not cfg.csv_path:
        raise DataError("provider=csv requiert --csv-path")
    return _normalise(pd.read_csv(cfg.csv_path))


def generate_synthetic(n: int = 2000, seed: int = 7, drift: float = 0.0) -> pd.DataFrame:
    """Série à volatilité groupée (GARCH(1,1)) et direction imprévisible.

    Propriétés voulues, qui servent de test de bout en bout :
    - la **volatilité** est fortement autocorrélée => l'événement ``amplitude``
      doit être prédictible, le score de Brier doit battre la baseline ;
    - les **signes** des rendements sont i.i.d. => l'événement ``direction`` ne
      doit *pas* être prédictible. Un pipeline qui trouve de l'edge ici a une
      fuite de données.
    """
    rng = np.random.default_rng(seed)
    omega, alpha, beta = 1e-7, 0.10, 0.87
    var = omega / (1 - alpha - beta)
    returns, variances = np.empty(n), np.empty(n)
    for t in range(n):
        shock = rng.normal(0.0, np.sqrt(var))
        returns[t], variances[t] = drift + shock, var
        var = omega + alpha * shock**2 + beta * var

    close = 1.10 * np.exp(np.cumsum(returns))
    sigma = np.sqrt(variances) * close
    high = close + np.abs(rng.normal(0, sigma))
    low = close - np.abs(rng.normal(0, sigma))
    open_ = np.concatenate([[close[0]], close[:-1]])
    index = pd.bdate_range("2015-01-01", periods=n, name="datetime")
    return pd.DataFrame(
        {"open": open_, "high": np.maximum(high, close), "low": np.minimum(low, close),
         "close": close, "volume": 0.0},
        index=index,
    )


def load(cfg: DataConfig) -> pd.DataFrame:
    """Charge un OHLCV propre, trié, sans doublon, indexé par date."""
    if cfg.provider == "synthetic":
        return generate_synthetic(cfg.outputsize)
    if cfg.provider == "csv":
        return _load_csv(cfg)

    fetch = _fetch_alphavantage if cfg.provider == "alphavantage" else _fetch_twelvedata
    conn = _init_cache(cfg.cache_path)
    try:
        cached = _cache_read(conn, cfg)
        if cached is not None:
            return cached
        df = fetch(cfg)
        _cache_write(conn, cfg, df)
        return df
    finally:
        conn.close()
