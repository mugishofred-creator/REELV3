"""Recherche d'un edge **conditionnel** : existe-t-il des états où ça marche ?

Toutes les recherches précédentes de ce dépôt posaient la question en moyenne :
« la direction est-elle prédictible ? ». La réponse est non. Mais une moyenne
peut masquer une structure — il pourrait exister des états identifiables où elle
l'est, noyés dans une majorité de jours où elle ne l'est pas.

Un point méthodologique décide de tout ici : **un modèle unique entraîné sur
l'ensemble des états moyenne les régimes et efface la structure recherchée.**
Mesuré : en découpant a posteriori les prédictions d'un modèle global par
quantile de volatilité, l'AUC reste plate entre 0.512 et 0.531 sur tous les
régimes. En entraînant un modèle *par régime*, la dispersion apparaît. Pour
détecter un edge conditionnel, le modèle doit avoir le droit de conditionner.

Trois diagnostics accompagnent chaque régime, et aucun ne suffit seul :

1. **Le profil de décroissance.** Une dislocation économique réelle met des
   jours à se résorber ; un artefact de microstructure vit entièrement dans la
   première barre. C'est le discriminant le plus fiable de ce dépôt — il a tué
   un Sharpe de 3,69 et validé le régime de panique.
2. **La concentration.** Un gain dont 87 % provient de 1 % des observations
   n'est pas un edge, c'est une loterie — même si sa moyenne est positive.
3. **La t-stat de Newey-West**, corrigée du chevauchement. Et le seuil doit
   monter avec le nombre de régimes testés : quatre régimes, c'est quatre
   chances de trouver du bruit.
4. **La concentration dans le TEMPS.** Le contrôle le plus tardif et le plus
   décisif de ce dépôt. Un signal peut passer le décalage, répliquer sur un
   univers séparé, résister à l'ajout des entreprises faillies et afficher une
   t-stat de 2.80 — et n'être qu'un **événement unique**. Mesuré sur le régime
   de panique : les 3 meilleures journées portent 76 % du gain, les 5
   meilleures 108 %, et sans les 10 meilleures le total passe à −24,4. Cinq des
   dix meilleures journées sont le krach Covid de mars-avril 2020. La journée
   médiane rapporte +0,0001 et 50,0 % des journées gagnent : à l'échelle du
   jour ordinaire, il n'y a **rien**.

   La t-stat elle-même trompe dans ce cas : Newey-West suppose une variance
   finie et des queues raisonnables. Avec une distribution où un jour porte
   32 % du total, cette hypothèse ne tient pas.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

import numpy as np
import pandas as pd

from .carry import newey_west_tstat

logger = logging.getLogger(__name__)
TRADING_DAYS = 252

#: Découpage par défaut du percentile de volatilité. Volontairement grossier :
#: chaque régime supplémentaire est une chance de plus de trouver du bruit.
DEFAULT_REGIMES = (
    (0.00, 0.80, "normal (0-80%)"),
    (0.80, 0.95, "tendu (80-95%)"),
    (0.95, 1.01, "panique (95-100%)"),
)


def volatility_state(close: pd.Series, window: int = 20,
                     history: int = 500) -> pd.Series:
    """Percentile de la volatilité récente dans son propre passé.

    Strictement causal : la volatilité est calculée sur les ``window`` dernières
    barres, son rang sur les ``history`` dernières, et le tout est décalé d'une
    barre. L'état est donc connu avant la barre qu'il qualifie.
    """
    returns = np.log(close.astype(float)).diff()
    realised = returns.rolling(window, min_periods=window).std()
    return realised.rolling(history, min_periods=history // 2).rank(pct=True).shift(1)


@dataclass(frozen=True)
class RegimeDiagnostic:
    name: str
    n: int
    auc: float
    decay: dict[int, float]        # horizon -> rendement annualisé
    tstat: float
    top_1pct_share: float
    median_trade: float
    hit_rate: float

    @property
    def survives_delay(self) -> bool:
        """Le rendement persiste-t-il au-delà de la première barre ?"""
        first = self.decay.get(1, 0.0)
        second = self.decay.get(2, 0.0)
        return first > 0 and second > 0.5 * first

    @property
    def is_concentrated(self) -> bool:
        """Un gain porté par une poignée d'observations n'est pas un edge.

        Le ratio n'a de sens que si un gain existe : avec un total négatif ou
        proche de zéro il devient négatif ou explose — mesuré à −4,5 sur un
        cas de test. La question « d'où vient le gain ? » ne se pose pas quand
        il n'y a pas de gain, d'où le ``NaN`` renvoyé dans ce cas.
        """
        return bool(np.isfinite(self.top_1pct_share) and self.top_1pct_share > 0.5)

    def verdict(self) -> str:
        if self.decay.get(1, 0.0) <= 0:
            return "pas de gain"
        if not self.survives_delay:
            return "meurt au décalage — artefact de microstructure"
        if abs(self.tstat) < 2:
            marker = " (et concentré sur quelques jours)" if self.is_concentrated else ""
            return f"survit au décalage mais non significatif{marker}"
        if self.is_concentrated:
            return "significatif mais porté par une poignée d'observations"
        return "survit au décalage ET significatif"

    def row(self) -> dict:
        return {
            "régime": self.name, "n": self.n, "AUC": round(self.auc, 4),
            **{f"j+{h}": round(v, 4) for h, v in self.decay.items()},
            "t-stat": round(self.tstat, 2),
            "top 1%": round(self.top_1pct_share, 3),
            "% gagnants": round(self.hit_rate, 3),
        }


def diagnose(predictions: pd.DataFrame, name: str,
             horizons: tuple[int, ...] = (1, 2, 3, 5)) -> RegimeDiagnostic:
    """Diagnostic complet d'un régime.

    ``predictions`` doit porter ``p``, ``baseline`` et une colonne ``f{h}`` par
    horizon : le rendement de la barre ``t+h`` **seule**, pas cumulé. C'est ce
    qui rend le profil de décroissance lisible — on veut savoir si le gain se
    reproduit chaque jour, pas s'il s'accumule.
    """
    from sklearn.metrics import roc_auc_score

    position = np.sign(predictions["p"] - predictions["baseline"])
    decay = {}
    for h in horizons:
        column = f"f{h}"
        if column not in predictions:
            continue
        pnl = (position * predictions[column]).dropna()
        decay[h] = float(pnl.mean() * TRADING_DAYS)

    first = (position * predictions[f"f{horizons[0]}"]).dropna()
    ordered = first.sort_values()
    total = float(ordered.sum())
    top = float(ordered.tail(max(1, int(len(ordered) * 0.01))).sum())
    # Le ratio n'est défini que s'il y a un gain à décomposer. Un total nul ou
    # négatif produirait une part négative ou divergente, sans signification.
    share = top / total if total > abs(ordered).sum() * 1e-6 else float("nan")

    y = predictions.get("y")
    auc = float("nan")
    if y is not None and y.nunique() > 1:
        auc = float(roc_auc_score(y, predictions["p"]))

    return RegimeDiagnostic(
        name=name, n=len(predictions), auc=auc, decay=decay,
        tstat=newey_west_tstat(pd.Series(first.to_numpy()), lags=5),
        top_1pct_share=share,
        median_trade=float(first.median()),
        hit_rate=float((first > 0).mean()),
    )


def event_concentration(predictions: pd.DataFrame, date_column: str = "date",
                        pnl_column: str = "pnl") -> pd.DataFrame:
    """Combien de **journées** portent le résultat ?

    Distinct de la concentration par observation : un gain réparti sur 300
    observations peut n'être qu'une seule journée de marché vue à travers 300
    actifs corrélés. C'est exactement le cas qui a invalidé le dernier signal
    de ce dépôt — l'agrégation par actif donnait l'illusion d'un échantillon
    large là où il n'y avait qu'une poignée d'événements.

    Règle de lecture : si retirer les 10 meilleures journées d'un historique de
    plusieurs milliers rend le total négatif, ce n'est pas une stratégie, c'est
    un pari sur quelques dates — et il ne se répliquera pas.
    """
    daily = predictions.groupby(date_column)[pnl_column].sum().sort_values(ascending=False)
    total = float(daily.sum())
    rows = []
    for n in (1, 3, 5, 10, 20):
        if n > len(daily):
            break
        head = float(daily.head(n).sum())
        rows.append({
            "meilleures journées": n,
            "part du gain": round(head / total, 3) if total != 0 else float("nan"),
            "total sans elles": round(total - head, 3),
        })
    table = pd.DataFrame(rows).set_index("meilleures journées")
    ten = min(10, len(daily))
    without_ten = total - float(daily.head(ten).sum())
    share_ten = float(daily.head(ten).sum() / total) if total > 0 else float("nan")

    table.attrs["n_dates"] = int(len(daily))
    table.attrs["median_day"] = float(daily.median())
    table.attrs["winning_days"] = float((daily > 0).mean())
    table.attrs["top10_share"] = share_ten
    # Un total qui devient négatif sans les dix meilleures journées : le
    # résultat est un événement, pas un effet.
    table.attrs["is_single_event"] = bool(total > 0 and without_ten <= 0)

    # Le drapeau binaire est un seuil grossier : 69 % du gain porté par dix
    # journées sur quatre mille ne le déclenche pas, et reste pourtant un
    # profil de loterie. On gradue donc, en rapportant la part des dix
    # meilleures journées à leur poids dans l'échantillon.
    if not np.isfinite(share_ten) or total <= 0:
        table.attrs["concentration"] = "sans objet (pas de gain)"
    elif table.attrs["is_single_event"]:
        table.attrs["concentration"] = "événement unique — non exploitable"
    elif share_ten > 0.5:
        table.attrs["concentration"] = "très concentré — profil de loterie"
    elif share_ten > 0.25:
        table.attrs["concentration"] = "concentré — fragile"
    else:
        table.attrs["concentration"] = "réparti"
    return table


def report(diagnostics: list[RegimeDiagnostic]) -> str:
    table = pd.DataFrame([d.row() for d in diagnostics]).set_index("régime")
    lines = [table.to_string(), "", "Verdicts :"]
    lines += [f"  {d.name:<24}{d.verdict()}" for d in diagnostics]
    lines += [
        "",
        f"Rappel : {len(diagnostics)} régimes testés — le seuil de significativité",
        "doit monter en conséquence (tests multiples).",
    ]
    return "\n".join(lines)
