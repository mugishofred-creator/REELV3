"""Asymétrie des queues : la baisse est-elle plus prédictible que la hausse ?

Question distincte des deux précédentes. `direction` demande *dans quel sens* —
imprédictible. `amplitude` demande *de combien* sans le sens — prédictible
(AUC 0.816) mais non monétisable, faute de savoir où aller.

Entre les deux : **P(forte baisse)** et **P(forte hausse)**, mesurées
séparément. Si les deux sont également prédictibles, l'amplitude épuise
l'information et il n'y a rien de neuf. Si la baisse l'est davantage, alors il
existe une information directionnelle exploitable — pas pour parier sur le sens,
mais pour **réduire l'exposition**, ce dont on a déjà montré que ça améliore un
portefeuille.

Choix de conception dicté par l'échec précédent : ce projet a invalidé un signal
qui avait franchi quatre contrôles parce que **cinq journées portaient 108 % de
son gain**. On cherche donc explicitement un effet à **nombreux événements
indépendants** — un seuil de queue à 5-10 % d'occurrence produit des milliers
d'épisodes répartis sur vingt ans, pas une poignée de krachs.

Les deux labels sont construits en miroir exact, même horizon et même seuil, de
sorte que tout écart de prédictibilité mesure une vraie asymétrie et non un
artefact de définition.
"""

from __future__ import annotations

import logging

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)
TRADING_DAYS = 252


def tail_labels(prices: pd.DataFrame, horizon: int = 10,
                threshold: float = 0.05) -> tuple[pd.Series, pd.Series, pd.Series]:
    """Trois labels en miroir sur la fenêtre ``(t, t+horizon]``.

    - ``down`` : le prix touche ``−threshold`` à un moment de la fenêtre
    - ``up``   : le prix touche ``+threshold``
    - ``both`` : les deux (utile pour isoler les fenêtres à double queue)

    Les extrêmes sont mesurés sur les plus hauts et plus bas **intra-barre**,
    donc sur le chemin réellement parcouru, pas seulement sur les clôtures : une
    baisse de 6 % touchée en séance puis refermée compte, parce qu'un stop
    l'aurait déclenchée.
    """
    close = prices["close"].astype(float)
    high, low = prices["high"].astype(float), prices["low"].astype(float)
    h = horizon

    future_low = low.shift(-1).rolling(h, min_periods=h).min().shift(-(h - 1))
    future_high = high.shift(-1).rolling(h, min_periods=h).max().shift(-(h - 1))

    down = (future_low / close - 1.0) <= -threshold
    up = (future_high / close - 1.0) >= threshold

    observable = future_low.notna() & future_high.notna()
    to_series = lambda mask: pd.Series(
        np.where(observable, mask.astype(float), np.nan), index=prices.index
    )
    return to_series(down), to_series(up), to_series(down & up)


def asymmetry_report(down: dict, up: dict) -> str:
    """Compare les deux queues terme à terme.

    Un écart d'AUC est plus parlant qu'un skill : le skill dépend du taux de
    base, qui diffère mécaniquement entre les deux queues (les marchés montent
    en moyenne, donc la queue haute est plus fréquente).
    """
    lines = [
        f"{'métrique':<16}{'BAISSE':>12}{'HAUSSE':>12}{'écart':>12}",
        "-" * 52,
    ]
    for key, label in (("auc", "AUC"), ("skill", "Brier skill"),
                       ("base", "taux de base")):
        d, u = down.get(key, float("nan")), up.get(key, float("nan"))
        lines.append(f"{label:<16}{d:>12.4f}{u:>12.4f}{d - u:>+12.4f}")

    gap = down.get("auc", 0.0) - up.get("auc", 0.0)
    if gap > 0.02:
        verdict = "La BAISSE est plus prédictible — asymétrie exploitable"
    elif gap < -0.02:
        verdict = "La HAUSSE est plus prédictible — asymétrie inversée"
    else:
        verdict = "Symétrique : l'amplitude épuise l'information, rien de neuf"
    lines += ["", f">>> {verdict}"]
    return "\n".join(lines)
