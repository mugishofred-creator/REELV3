"""Évaluation d'une *probabilité* — pas d'une décision.

``classification_report`` (précision, rappel, F1) juge un choix binaire après
seuillage : il ne dit rien de la qualité du nombre. Pour une probabilité on
utilise des *règles de score propres*, c'est-à-dire des scores qu'on minimise en
annonçant sa vraie croyance : Brier et log-loss.

La seule question qui compte : **est-ce que je bats la baseline ?** La baseline
est la prédiction constante égale au taux de base. Si le skill score est ≤ 0,
les indicateurs n'apportent rien, quel que soit le nombre de modèles empilés.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd
from sklearn.metrics import brier_score_loss, log_loss, roc_auc_score

EPS = 1e-12


@dataclass(frozen=True)
class Report:
    n: int
    base_rate: float
    brier: float
    brier_baseline: float
    brier_skill: float
    logloss: float
    logloss_baseline: float
    logloss_skill: float
    auc: float
    ece: float
    sharpness: float
    reliability: pd.DataFrame
    per_fold: pd.DataFrame

    @property
    def has_skill(self) -> bool:
        """Un edge n'est crédible que s'il apparaît sur les *deux* règles."""
        return self.brier_skill > 0 and self.logloss_skill > 0

    def to_text(self) -> str:
        verdict = (
            "SKILL POSITIF — le modèle bat la baseline"
            if self.has_skill
            else "PAS DE SKILL — la baseline fait aussi bien ou mieux"
        )
        lines = [
            f"Échantillons hors-échantillon : {self.n}",
            f"Taux de base observé          : {self.base_rate:.4f}",
            "",
            f"{'Brier':<12}{self.brier:>10.5f}  (baseline {self.brier_baseline:.5f})"
            f"   skill {self.brier_skill:+.4f}",
            f"{'LogLoss':<12}{self.logloss:>10.5f}  (baseline {self.logloss_baseline:.5f})"
            f"   skill {self.logloss_skill:+.4f}",
            f"{'AUC':<12}{self.auc:>10.5f}   (0.5 = aucun pouvoir de classement)",
            f"{'ECE':<12}{self.ece:>10.5f}   (erreur de calibration, plus bas = mieux)",
            f"{'Sharpness':<12}{self.sharpness:>10.5f}   (écart-type des probas ; 0 = "
            "toujours la baseline)",
            "",
            f">>> {verdict}",
            "",
            "Courbe de fiabilité — « quand j'annonce p, ça arrive combien de fois ? »",
            self.reliability.to_string(index=False),
            "",
            "Détail par fold — sous dérive du taux de base, l'agrégat seul trompe :",
            self.per_fold.to_string(index=False),
        ]
        return "\n".join(lines)


def reliability_table(y: np.ndarray, p: np.ndarray, n_bins: int = 10) -> pd.DataFrame:
    """Table de fiabilité par déciles de probabilité prédite.

    Un modèle calibré aligne ``p_moyen`` et ``freq_observee``. Un écart
    systématique vers le haut = sur-confiance.
    """
    edges = np.quantile(p, np.linspace(0, 1, n_bins + 1))
    edges = np.unique(edges)
    if len(edges) < 3:  # probabilités quasi constantes
        return pd.DataFrame(
            [{"bin": "toutes", "n": len(p), "p_moyen": p.mean(),
              "freq_observee": y.mean(), "ecart": y.mean() - p.mean()}]
        )
    bins = np.clip(np.digitize(p, edges[1:-1], right=True), 0, len(edges) - 2)
    rows = []
    for b in range(len(edges) - 1):
        mask = bins == b
        if not mask.any():
            continue
        rows.append(
            {
                "bin": f"[{edges[b]:.3f},{edges[b + 1]:.3f}]",
                "n": int(mask.sum()),
                "p_moyen": float(p[mask].mean()),
                "freq_observee": float(y[mask].mean()),
                "ecart": float(y[mask].mean() - p[mask].mean()),
            }
        )
    return pd.DataFrame(rows)


def expected_calibration_error(y: np.ndarray, p: np.ndarray, n_bins: int = 10) -> float:
    table = reliability_table(y, p, n_bins)
    weights = table["n"] / table["n"].sum()
    return float((weights * table["ecart"].abs()).sum())


def per_fold_table(df: pd.DataFrame) -> pd.DataFrame:
    """Métriques fold par fold.

    Un modèle peut avoir un vrai pouvoir de classement dans chaque fold et un
    AUC agrégé proche de 0.5 si le taux de base se déplace d'un fold à l'autre :
    le regroupement mélange des populations non comparables. Sous dérive, cette
    table est la lecture qui fait foi.
    """
    rows = []
    for fold, g in df.groupby("fold"):
        y = g["y"].to_numpy(dtype=float)
        p = np.clip(g["p"].to_numpy(dtype=float), EPS, 1 - EPS)
        b = np.clip(g["baseline"].to_numpy(dtype=float), EPS, 1 - EPS)
        brier, brier_b = brier_score_loss(y, p), brier_score_loss(y, b)
        rows.append(
            {
                "fold": int(fold),
                "n": len(g),
                "taux_base": round(float(y.mean()), 4),
                "brier": round(float(brier), 5),
                "brier_base": round(float(brier_b), 5),
                "skill": round(float(1 - brier / brier_b) if brier_b > 0 else 0.0, 4),
                "auc": round(float(roc_auc_score(y, p)), 4) if len(np.unique(y)) > 1 else np.nan,
            }
        )
    return pd.DataFrame(rows)


def evaluate(predictions: pd.DataFrame, n_bins: int = 10) -> Report:
    """Évalue la sortie de :func:`trading_bot.model.walk_forward_predict`."""
    df = predictions.dropna(subset=["p", "y"])
    y = df["y"].to_numpy(dtype=float)
    p = np.clip(df["p"].to_numpy(dtype=float), EPS, 1 - EPS)
    base = np.clip(df["baseline"].to_numpy(dtype=float), EPS, 1 - EPS)

    brier = brier_score_loss(y, p)
    brier_base = brier_score_loss(y, base)
    ll = log_loss(y, p, labels=[0.0, 1.0])
    ll_base = log_loss(y, base, labels=[0.0, 1.0])

    return Report(
        n=len(df),
        base_rate=float(y.mean()),
        brier=float(brier),
        brier_baseline=float(brier_base),
        # Skill score : 1 = parfait, 0 = aussi bon que la baseline, <0 = pire.
        brier_skill=float(1 - brier / brier_base) if brier_base > 0 else 0.0,
        logloss=float(ll),
        logloss_baseline=float(ll_base),
        logloss_skill=float(1 - ll / ll_base) if ll_base > 0 else 0.0,
        auc=float(roc_auc_score(y, p)) if len(np.unique(y)) > 1 else float("nan"),
        ece=expected_calibration_error(y, p, n_bins),
        sharpness=float(p.std()),
        reliability=reliability_table(y, p, n_bins),
        per_fold=per_fold_table(df),
    )
