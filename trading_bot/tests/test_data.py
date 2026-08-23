"""Chargement des données et cache."""

from __future__ import annotations

import time

import numpy as np
import pandas as pd
import pytest

from trading_bot import data
from trading_bot.config import DataConfig


def test_synthetic_series_is_coherent():
    df = data.generate_synthetic(500, seed=1)
    assert (df["high"] >= df["close"]).all()
    assert (df["low"] <= df["close"]).all()
    assert df.index.is_monotonic_increasing
    assert not df.index.has_duplicates


def test_synthetic_series_has_volatility_clustering():
    """Propriété dont dépend le contrôle positif : sans elle, le test ne teste rien."""
    df = data.generate_synthetic(3000, seed=2)
    abs_returns = np.log(df["close"]).diff().abs().dropna()
    assert abs_returns.autocorr(lag=1) > 0.1
    # ...alors que les rendements signés, eux, ne sont pas autocorrélés.
    assert abs(np.log(df["close"]).diff().dropna().autocorr(lag=1)) < 0.06


def test_normalise_drops_bars_without_close():
    raw = pd.DataFrame(
        {
            "datetime": ["2024-01-03", "2024-01-02", "2024-01-01"],
            "open": ["1.0", "1.1", "1.2"],
            "high": ["1.5", "1.6", "1.7"],
            "low": ["0.5", "0.6", "0.7"],
            "close": ["1.2", None, "1.4"],
            "volume": ["10", "20", "30"],
        }
    )
    df = data._normalise(raw)
    assert len(df) == 2
    assert df.index.is_monotonic_increasing        # l'API renvoie l'ordre inverse
    assert df["close"].notna().all()


def test_cache_expires(tmp_path):
    cfg = DataConfig(provider="twelvedata", cache_path=str(tmp_path / "c.db"),
                     cache_ttl_hours=1.0)
    conn = data._init_cache(cfg.cache_path)
    frame = data.generate_synthetic(50)
    data._cache_write(conn, cfg, frame)
    assert data._cache_read(conn, cfg) is not None

    # Vieillit artificiellement l'entrée de deux heures.
    conn.execute("UPDATE ohlcv SET fetched_at = ?", (time.time() - 7200,))
    conn.commit()
    assert data._cache_read(conn, cfg) is None, "un cache sans TTL fige les données à jamais"
    conn.close()


def test_missing_api_key_is_reported_clearly(monkeypatch):
    monkeypatch.delenv("TWELVEDATA_API_KEY", raising=False)
    with pytest.raises(data.DataError, match="Aucune clé API"):
        data._fetch_twelvedata(DataConfig(provider="twelvedata"))


def test_no_api_key_is_hardcoded_in_the_source():
    """Garde-fou : une clé en dur finit dans l'historique git, puis publiée."""
    import pathlib
    import re

    root = pathlib.Path(__file__).resolve().parent.parent
    suspicious = re.compile(r"['\"][0-9a-f]{32}['\"]")
    for path in root.rglob("*.py"):
        assert not suspicious.search(path.read_text(encoding="utf-8")), path
