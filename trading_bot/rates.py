"""Taux directeurs et financement overnight.

Ignorer le financement est le biais le plus sérieux qui restait au backtest.
Avec une détention moyenne d'environ deux jours et une exposition de 27 % du
temps, le swap s'applique à presque chaque position — et il n'est pas
symétrique : une stratégie qui prend structurellement le même côté sur une
devise à taux bas paie le différentiel jour après jour.

Source : BIS, ``WS_CBPOL`` — taux directeur quotidien de chaque banque centrale,
depuis 2005, sans clé d'API. Couvre les taux négatifs réellement pratiqués
(−0,75 % en CHF, −0,10 % en JPY), ce qui compte : ce sont précisément les
périodes où le carry inverse le signe du résultat.

Convention de portage, pour une position **longue** d'une paire BASE/QUOTE :

    carry annualisé = taux_BASE − taux_QUOTE

Long EUR/USD = long EUR, short USD : on perçoit le taux EUR et on paie le taux
USD. Une position **courte** inverse le signe — c'est géré par le signe de la
position elle-même, pas par un cas particulier.
"""

from __future__ import annotations

import logging
import sqlite3
import time
from io import StringIO

import numpy as np
import pandas as pd
import requests

logger = logging.getLogger(__name__)

BIS_URL = "https://stats.bis.org/api/v2/data/dataflow/BIS/WS_CBPOL/1.0/D.{area}?format=csv"

#: Zone BIS par devise. « XM » est la zone euro.
AREA_BY_CURRENCY = {
    "USD": "US", "EUR": "XM", "GBP": "GB",
    "JPY": "JP", "CHF": "CH", "CAD": "CA", "AUD": "AU",
    "NZD": "NZ", "SEK": "SE", "NOK": "NO", "MXN": "MX",
}

#: Symbole Yahoo -> (devise de base, devise de cotation).
#:
#: Attention au piège : ``JPY=X``, ``CHF=X`` et ``CAD=X`` sont des paires
#: **USD/xxx**, pas xxx/USD. Inverser le sens inverserait le carry — et donc le
#: signe de la correction sur trois des six paires.
FX_PAIRS = {
    "EURUSD=X": ("EUR", "USD"),
    "GBPUSD=X": ("GBP", "USD"),
    "AUDUSD=X": ("AUD", "USD"),
    "JPY=X": ("USD", "JPY"),
    "CHF=X": ("USD", "CHF"),
    "CAD=X": ("USD", "CAD"),
    "NZDUSD=X": ("NZD", "USD"),
    "SEK=X": ("USD", "SEK"),
    "NOK=X": ("USD", "NOK"),
    "MXN=X": ("USD", "MXN"),
}

#: Actifs non-FX : une position longue est financée en dollars (on emprunte),
#: une position courte perçoit ce même taux. On les modélise donc comme une
#: paire ACTIF/USD dont la « devise de base » ne rapporte rien.
#:
#: Deux approximations assumées : le rendement du dividende du S&P (~1,8 %/an,
#: absent de l'indice prix ^GSPC) compenserait partiellement le financement
#: d'une position longue, et les frais d'emprunt de titres pour les positions
#: courtes ne sont pas modélisés — les deux jouent en défaveur du réalisme des
#: shorts. ``base_yield`` permet de les corriger si besoin.
NON_FX_FUNDING_CURRENCY = "USD"


class RatesError(RuntimeError):
    pass


def _init_cache(path: str) -> sqlite3.Connection:
    conn = sqlite3.connect(path)
    conn.execute(
        """CREATE TABLE IF NOT EXISTS policy_rates (
               area TEXT PRIMARY KEY, fetched_at REAL, payload TEXT)"""
    )
    conn.commit()
    return conn


def fetch_policy_rate(currency: str, cache_path: str = "rates_cache.db",
                      ttl_hours: float = 168.0, max_attempts: int = 3) -> pd.Series:
    """Taux directeur quotidien d'une devise, en fraction annuelle (0.0425 = 4,25 %).

    TTL d'une semaine par défaut : un taux directeur bouge huit fois par an, le
    rafraîchir quotidiennement n'aurait aucun sens.
    """
    area = AREA_BY_CURRENCY.get(currency)
    if area is None:
        raise RatesError(f"Devise non couverte : {currency}")

    conn = _init_cache(cache_path)
    try:
        row = conn.execute(
            "SELECT fetched_at, payload FROM policy_rates WHERE area=?", (area,)
        ).fetchone()
        if row and (time.time() - row[0]) / 3600.0 <= ttl_hours:
            # Relecture en CSV plutôt qu'en JSON : ``Series.to_json`` encode
            # l'index en époque-millisecondes, et la relecture le réinterprétait
            # comme des nanosecondes — tout l'historique retombait en 1969 et
            # les taux devenaient NaN sans la moindre erreur.
            series = pd.read_csv(StringIO(row[1]), index_col=0, parse_dates=True).iloc[:, 0]
            series.name = currency
            return series

        last_error: Exception | None = None
        for attempt in range(max_attempts):
            try:
                response = requests.get(
                    BIS_URL.format(area=area),
                    headers={"User-Agent": "Mozilla/5.0"}, timeout=90,
                )
                response.raise_for_status()
                frame = pd.read_csv(StringIO(response.text), low_memory=False)
                frame = frame[["TIME_PERIOD", "OBS_VALUE"]].dropna()
                series = pd.Series(
                    frame["OBS_VALUE"].to_numpy(dtype=float) / 100.0,
                    index=pd.to_datetime(frame["TIME_PERIOD"]),
                    name=currency,
                ).sort_index()
                series = series[~series.index.duplicated(keep="last")]
                conn.execute(
                    "INSERT OR REPLACE INTO policy_rates VALUES (?,?,?)",
                    (area, time.time(), series.to_csv()),
                )
                conn.commit()
                logger.info("%s : %d observations, %s -> %s", currency, len(series),
                            series.index[0].date(), series.index[-1].date())
                return series
            except Exception as exc:
                last_error = exc
                time.sleep(2**attempt)
        raise RatesError(f"Récupération impossible pour {currency}: {last_error}")
    finally:
        conn.close()


def load_rates(currencies: list[str], cache_path: str = "rates_cache.db") -> pd.DataFrame:
    """Table des taux, alignée sur un calendrier quotidien continu.

    Le report en avant (``ffill``) est le bon comportement ici : un taux
    directeur *reste* en vigueur entre deux décisions, il n'est pas manquant.
    """
    series = {}
    for currency in currencies:
        try:
            series[currency] = fetch_policy_rate(currency, cache_path)
        except RatesError as exc:
            logger.warning("%s ignorée : %s", currency, exc)
    if not series:
        raise RatesError("Aucun taux récupéré.")

    frame = pd.DataFrame(series).sort_index()
    calendar = pd.date_range(frame.index.min(), frame.index.max(), freq="D")
    return frame.reindex(calendar).ffill()


def carry_rate(symbol: str, rates: pd.DataFrame, base_yield: float = 0.0) -> pd.Series:
    """Différentiel annualisé perçu par une position **longue** d'une unité.

    Renvoie une série quotidienne. Le signe de la position s'applique ensuite :
    une position courte inverse mécaniquement le carry.
    """
    if symbol in FX_PAIRS:
        base, quote = FX_PAIRS[symbol]
        if base not in rates or quote not in rates:
            raise RatesError(f"Taux manquant pour {symbol} ({base}/{quote})")
        return rates[base] - rates[quote]

    # Non-FX : financé en dollars, aucun rendement de base par défaut.
    quote = NON_FX_FUNDING_CURRENCY
    if quote not in rates:
        raise RatesError(f"Taux {quote} manquant pour financer {symbol}")
    return base_yield - rates[quote]


def daily_carry(symbol: str, index: pd.DatetimeIndex, rates: pd.DataFrame,
                base_yield: float = 0.0) -> pd.Series:
    """Portage réellement encouru **entre deux barres consécutives**.

    Le prorata se fait sur les jours **calendaires** écoulés, pas sur les barres :
    un vendredi au lundi porte trois jours de financement, pas un. C'est
    exactement le « triple swap » du week-end, et l'ignorer sous-estimerait le
    financement d'environ 40 % sur une stratégie quotidienne.
    """
    annual = carry_rate(symbol, rates, base_yield).reindex(index).ffill()
    elapsed = pd.Series(index, index=index).diff().dt.days.fillna(1.0)
    return (annual * elapsed / 365.0).fillna(0.0)
