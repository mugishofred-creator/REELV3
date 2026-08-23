"""Validation temporelle purgée et calibration des probabilités.

C'est ici que se joue la différence entre « un score entre 0 et 1 » et « une
probabilité ». Trois mécanismes :

1. **Walk-forward purgé.** On n'entraîne jamais sur des barres postérieures au
   test, et on retire du train tout échantillon dont le *label* se résout après
   le début du test — sinon un label d'entraînement contient déjà l'information
   de la période testée. Un ``train_test_split(shuffle=True)`` sur une série
   temporelle fait exactement l'inverse.
2. **Calibration hors-échantillon.** ``predict_proba`` n'est pas calibré : un
   RandomForest écrase ses sorties vers 0.5 (le moyennage des arbres), un réseau
   avec early-stopping est sur-confiant. On apprend donc une transformation
   (Platt ou isotonique) sur une tranche *postérieure* au train et *antérieure*
   au test.
3. **Aucun rééchantillonnage.** SMOTE force le taux de base à 50/50. Pour une
   décision c'est discutable, pour une probabilité c'est disqualifiant : la
   sortie ne correspond plus à aucune fréquence observable.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.impute import SimpleImputer
from sklearn.isotonic import IsotonicRegression
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from .config import ModelConfig, SplitConfig

logger = logging.getLogger(__name__)
EPS = 1e-6


def resolution_positions(index: pd.Index, resolution: pd.Series) -> np.ndarray:
    """Position entière de la barre à laquelle chaque label devient connu.

    ``-1`` pour les labels jamais résolus (ils seront retirés avec les NaN).
    """
    return index.get_indexer(pd.DatetimeIndex(resolution))


# --------------------------------------------------------------------------- #
# Découpage
# --------------------------------------------------------------------------- #
@dataclass(frozen=True)
class Fold:
    index: int
    train: np.ndarray
    calibration: np.ndarray
    test: np.ndarray
    purged: int


def purged_walk_forward(n: int, res_pos: np.ndarray, cfg: SplitConfig) -> list[Fold]:
    """Folds chronologiques emboîtés, avec purge et embargo.

    Le train s'étend (*expanding window*) : chaque fold rejoue la situation
    réelle d'un praticien qui réentraîne avec tout l'historique disponible.
    """
    test_size = (n - cfg.min_train_size) // cfg.n_splits
    if test_size <= 0:
        raise ValueError(
            f"{n} échantillons insuffisants pour {cfg.n_splits} folds "
            f"avec min_train_size={cfg.min_train_size}"
        )

    folds: list[Fold] = []
    for k in range(cfg.n_splits):
        test_start = cfg.min_train_size + k * test_size
        test_stop = test_start + test_size if k < cfg.n_splits - 1 else n
        test = np.arange(test_start, test_stop)

        # Purge : un échantillon d'entraînement dont le label se résout après
        # (test_start − embargo) chevauche la période testée.
        start = 0 if cfg.max_train_size is None else max(0, test_start - cfg.max_train_size)
        candidates = np.arange(start, test_start)
        cutoff = test_start - cfg.embargo
        keep = res_pos[candidates] < cutoff
        train_all, purged = candidates[keep], int((~keep).sum())

        if len(train_all) < cfg.min_train_size // 2:
            logger.warning("Fold %d ignoré : train trop court après purge", k)
            continue

        # La tranche de calibration est la fin du train — donc la période la
        # plus proche du test, celle dont le régime lui ressemble le plus.
        n_calib = max(30, int(len(train_all) * cfg.calibration_fraction))
        n_calib = min(n_calib, len(train_all) // 2)
        folds.append(
            Fold(k, train_all[:-n_calib], train_all[-n_calib:], test, purged)
        )
    return folds


# --------------------------------------------------------------------------- #
# Modèles
# --------------------------------------------------------------------------- #
def build_estimator(cfg: ModelConfig) -> Pipeline:
    """Le scaler est *dans* le pipeline : il n'est ajusté que sur le train du fold.

    Le bot d'origine appelait ``StandardScaler().fit_transform`` sur l'ensemble
    du jeu avant de découper — la moyenne et l'écart-type du test fuitaient dans
    le train.
    """
    if cfg.name == "logistic":
        return Pipeline(
            [
                ("impute", SimpleImputer(strategy="median")),
                ("scale", StandardScaler()),
                ("clf", LogisticRegression(C=0.5, max_iter=2000, random_state=cfg.random_state)),
            ]
        )
    if cfg.name == "gbm":
        # Capacité volontairement basse : peu de données, signal faible.
        # HistGradientBoosting gère les NaN nativement, pas d'imputation.
        return Pipeline(
            [
                (
                    "clf",
                    HistGradientBoostingClassifier(
                        max_depth=3,
                        max_iter=200,
                        learning_rate=0.05,
                        min_samples_leaf=40,
                        l2_regularization=1.0,
                        early_stopping=False,
                        random_state=cfg.random_state,
                    ),
                )
            ]
        )
    raise ValueError(f"Modèle inconnu : {cfg.name!r}")


class Calibrator:
    """Recalage d'un score brut vers une probabilité.

    - ``sigmoid`` (Platt) : régression logistique sur le log-odds du score.
      Robuste, 2 paramètres, adapté aux petits échantillons de calibration.
    - ``isotonic`` : monotone non paramétrique, plus souple mais gourmand en
      données ; à réserver aux tranches de calibration larges.
    """

    def __init__(self, method: str, reg: float = 1.0) -> None:
        self.method = method
        self.reg = reg
        self._model = None

    @staticmethod
    def _logit(p: np.ndarray) -> np.ndarray:
        p = np.clip(p, EPS, 1 - EPS)
        return np.log(p / (1 - p))

    def fit(self, scores: np.ndarray, y: np.ndarray) -> "Calibrator":
        if self.method == "none" or len(np.unique(y)) < 2:
            return self
        if self.method == "sigmoid":
            # Lissage de Platt : on remplace les cibles 0/1 par des cibles
            # amorties. Sans cela la calibration recopie la sur-confiance du
            # modèle au lieu de la corriger. La régularisation (C modéré) tire
            # la pente vers 0, donc les probabilités vers le taux de base —
            # exactement ce qu'il faut quand le signal est faible.
            n_pos, n_neg = float((y == 1).sum()), float((y == 0).sum())
            smoothed = np.where(y == 1, (n_pos + 1) / (n_pos + 2), 1 / (n_neg + 2))
            self._model = LogisticRegression(C=self.reg, solver="lbfgs")
            self._model.fit(self._logit(scores).reshape(-1, 1), (smoothed > 0.5).astype(int),
                            sample_weight=np.abs(smoothed - 0.5) * 2)
        elif self.method == "isotonic":
            self._model = IsotonicRegression(y_min=0.0, y_max=1.0, out_of_bounds="clip")
            self._model.fit(scores, y)
        else:
            raise ValueError(f"Calibration inconnue : {self.method!r}")
        return self

    def transform(self, scores: np.ndarray) -> np.ndarray:
        if self._model is None:
            return scores
        if self.method == "sigmoid":
            return self._model.predict_proba(self._logit(scores).reshape(-1, 1))[:, 1]
        return self._model.predict(scores)


# --------------------------------------------------------------------------- #
# Boucle principale
# --------------------------------------------------------------------------- #
def rolling_baseline(y: pd.Series, horizon: int, window: int) -> pd.Series:
    """Baseline climatologique glissante, strictement causale.

    Un label posé en ``t`` n'est connu qu'en ``t+horizon`` : on décale donc de
    ``horizon`` avant de moyenner. C'est la prévision « sans modèle » d'un
    praticien — la fréquence récente de l'événement — et c'est elle qu'un modèle
    doit battre pour justifier son existence.
    """
    known = y.shift(horizon)
    rolled = known.rolling(window, min_periods=min(30, window)).mean()
    return rolled.fillna(known.expanding(min_periods=1).mean())


def walk_forward_predict(
    X: pd.DataFrame, y: pd.Series, res_pos: np.ndarray,
    split_cfg: SplitConfig, model_cfg: ModelConfig,
    baseline: pd.Series | None = None,
) -> pd.DataFrame:
    """Produit une probabilité **hors-échantillon** pour chaque barre testable.

    Renvoie un DataFrame indexé par date : ``p`` (probabilité finale),
    ``p_raw`` (score du modèle avant calibration), ``baseline`` (la prévision
    sans modèle à cette date), ``y`` et ``fold``.
    """
    folds = purged_walk_forward(len(X), res_pos, split_cfg)
    X_values, y_values = X.to_numpy(dtype=float), y.to_numpy(dtype=float)
    rows = []

    for fold in folds:
        y_train = y_values[fold.train]
        if len(np.unique(y_train)) < 2:
            logger.warning("Fold %d ignoré : une seule classe au train", fold.index)
            continue

        estimator = build_estimator(model_cfg)
        estimator.fit(X_values[fold.train], y_train)

        raw = estimator.predict_proba(X_values[fold.test])[:, 1]
        calib_scores = estimator.predict_proba(X_values[fold.calibration])[:, 1]

        calibrator = Calibrator(model_cfg.calibration, model_cfg.calibration_reg)
        calibrator.fit(calib_scores, y_values[fold.calibration])
        p_test = calibrator.transform(raw)

        # Référence : la fréquence récente connue à la date de prédiction. Elle
        # n'utilise que des labels déjà résolus — jamais le taux de base du test,
        # qui serait une fuite.
        train_rate = float(np.concatenate([y_train, y_values[fold.calibration]]).mean())
        if baseline is None:
            fold_baseline = np.full(len(fold.test), train_rate)
        else:
            fold_baseline = baseline.to_numpy(dtype=float)[fold.test]
            fold_baseline = np.where(np.isfinite(fold_baseline), fold_baseline, train_rate)

        if model_cfg.prior == "adaptive":
            # Décomposition en log-odds :
            #     logit(p) = logit(prior récent)  +  évidence apportée par les indicateurs
            # L'évidence est centrée sur la tranche de calibration, de sorte
            # qu'un modèle sans information laisse strictement la baseline
            # intacte. C'est aussi la formulation qui rend chaque indicateur
            # lisible : une contribution en log-odds, additive et signée.
            evidence = Calibrator._logit(p_test) - float(
                np.mean(Calibrator._logit(calibrator.transform(calib_scores)))
            )
            evidence = model_cfg.evidence_weight * evidence
            p_test = 1.0 / (1.0 + np.exp(-(Calibrator._logit(fold_baseline) + evidence)))

        rows.append(
            pd.DataFrame(
                {
                    "p": p_test,
                    "p_raw": raw,
                    "baseline": fold_baseline,
                    "y": y_values[fold.test],
                    "fold": fold.index,
                },
                index=X.index[fold.test],
            )
        )
        logger.info(
            "Fold %d — train=%d calib=%d test=%d purgés=%d taux_base=%.3f",
            fold.index, len(fold.train), len(fold.calibration), len(fold.test),
            fold.purged, train_rate,
        )

    if not rows:
        raise RuntimeError("Aucun fold exploitable — série trop courte ou labels dégénérés.")
    return pd.concat(rows).sort_index()
