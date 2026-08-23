"""Configuration de l'expérience.

Tout ce qui influence un résultat est ici : la définition de l'événement, la
fenêtre de validation, le coût de transaction. Rien n'est codé en dur ailleurs,
de sorte qu'un run est entièrement décrit par un ``Config``.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field, asdict
from typing import Literal

EventKind = Literal["direction", "amplitude", "triple_barrier"]


@dataclass(frozen=True)
class LabelConfig:
    """Définit *l'événement* dont on estime la probabilité.

    C'est la décision la plus structurante de tout le projet : elle fixe ce que
    ``P = 0.62`` veut dire. Les trois familles ne sont pas également prédictibles.

    - ``direction`` : P(clôture t+h > clôture t). Taux de base ~50 %, edge réel
      très faible sur du FX quotidien. C'est le cas le plus dur.
    - ``amplitude`` : P(|variation| > seuil sur les h prochains jours). La
      volatilité est autocorrélée, donc c'est de loin le plus prédictible des
      trois — *à condition* que le seuil soit absolu (``threshold_mode="pct"``).
      Un seuil normalisé par l'ATR courant transforme l'événement en « la vol
      future dépassera-t-elle la vol récente ? », qui est un ratio quasi
      imprédictible : la normalisation annule précisément le signal recherché.
      Mesuré sur série synthétique à volatilité groupée : AUC 0.69 avec un
      seuil en pourcentage, 0.52 avec un seuil en ATR.
    - ``triple_barrier`` : P(toucher +``barrier_atr``×ATR avant
      −``barrier_atr``×ATR sous h jours). Directement exploitable pour un trade
      avec take-profit et stop-loss.
    """

    kind: EventKind = "direction"
    horizon: int = 1
    barrier_atr: float = 1.0
    atr_window: int = 14
    #: Fenêtre servant au *seuil* de l'événement ``amplitude``. Volontairement
    #: longue : le seuil doit être un niveau de référence stable, sinon
    #: l'événement devient « la vol future dépasse-t-elle la vol actuelle ? »,
    #: qui est imprédictible par construction et annule le clustering de
    #: volatilité que l'on cherche justement à exploiter.
    reference_window: int = 100
    #: Mode de seuil pour ``amplitude``. ``"pct"`` : seuil absolu en fraction du
    #: prix (recommandé). ``"atr"`` : seuil en multiples d'ATR — comparable
    #: entre actifs, mais bien moins prédictible, voir ci-dessus.
    threshold_mode: Literal["pct", "atr"] = "pct"
    barrier_pct: float = 0.005
    #: Pour triple_barrier : que faire quand aucune barrière n'est touchée.
    #: "drop" retire l'échantillon, "sign" l'étiquette par le signe du rendement.
    unresolved: Literal["drop", "sign"] = "sign"


@dataclass(frozen=True)
class SplitConfig:
    """Découpage temporel purgé.

    ``embargo`` est ajouté *en plus* de la purge automatique liée à l'horizon.
    La purge seule suffit à supprimer le recouvrement mécanique des labels ;
    l'embargo protège en plus de l'autocorrélation résiduelle des features.
    """

    n_splits: int = 5
    #: Fraction de la fenêtre d'entraînement réservée à la calibration.
    #: Elle est prise à la *fin* du train, donc juste avant le test.
    calibration_fraction: float = 0.3
    #: Barres supplémentaires retirées entre train et test.
    embargo: int = 5
    #: Taille minimale d'un fold d'entraînement, en barres.
    min_train_size: int = 250
    #: Plafond de la fenêtre d'entraînement. ``None`` = fenêtre expansive.
    #: Une fenêtre glissante s'adapte mieux aux changements de régime, au prix
    #: d'un échantillon plus petit.
    max_train_size: int | None = None
    #: Fenêtre de la baseline « climatologique » glissante. Sous dérive du taux
    #: de base, la moyenne de tout l'historique est une référence trop faible :
    #: on se compare à la fréquence *récente*, qui est ce qu'un praticien
    #: utiliserait réellement sans modèle.
    baseline_window: int = 250


@dataclass(frozen=True)
class ModelConfig:
    name: Literal["logistic", "gbm"] = "logistic"
    calibration: Literal["isotonic", "sigmoid", "none"] = "sigmoid"
    #: Régularisation de la calibration de Platt. Plus c'est bas, plus les
    #: probabilités sont tirées vers le taux de base — le bon réflexe quand le
    #: signal est faible, ce qui est la norme en finance de marché.
    calibration_reg: float = 1.0
    random_state: int = 42
    #: ``"rank"`` remplace chaque feature par son rang percentile glissant.
    #: Rend les features bornées et comparables entre régimes, ce qui évite
    #: l'inversion du modèle quand le test sort du support d'entraînement.
    feature_transform: Literal["rank", "raw"] = "rank"
    rank_window: int = 250
    #: ``"adaptive"`` ancre la probabilité finale sur la baseline glissante et ne
    #: laisse au modèle que l'*écart* en log-odds. Sous dérive du taux de base,
    #: c'est décisif : un modèle entraîné sur une période où l'événement arrive
    #: 44 % du temps prédira autour de 44 % dans une période où il arrive 86 %,
    #: alors que son *classement* reste bon. On sépare donc les deux rôles — le
    #: niveau vient de la fréquence récente, l'ordre vient des indicateurs.
    prior: Literal["adaptive", "train"] = "adaptive"
    #: Amortissement appliqué à l'évidence en log-odds. <1 rapproche la
    #: probabilité de la baseline. En finance de marché le signal est faible et
    #: instable : mieux vaut sous-affirmer que sur-affirmer, car le log-loss
    #: pénalise très durement une forte conviction fausse.
    evidence_weight: float = 0.5
    #: Aucun rééchantillonnage : SMOTE / class_weight déplacent le taux de base
    #: et rendent la sortie ininterprétable comme probabilité. Voir README.
    resample: Literal["none"] = "none"


@dataclass(frozen=True)
class BacktestConfig:
    """Coûts et exécution.

    ``execution_lag`` = 1 signifie qu'un signal calculé sur la clôture de t est
    exécuté à la clôture de t+1 — jamais au prix qui a servi à le calculer.
    """

    #: Coût proportionnel au notionnel échangé, **prélevé à chaque côté** :
    #: ``coût = |Δposition| × spread_bps / 10_000``.
    #:
    #: Trois précisions, parce que le nom prête à confusion :
    #:
    #: - **Par côté, pas par aller-retour.** Un cycle plat → long plein → plat
    #:   génère un turnover de 2, donc ``spread_bps=10`` y coûte 20 bps au total.
    #: - **Proportionnel, pas forfaitaire.** Passer de 0.3 à 0.4 ne coûte que
    #:   10 % de ce que coûte passer de 0 à 1. Le sizing étant continu, la
    #:   plupart des ajustements sont partiels.
    #: - **Ce n'est pas seulement le spread.** Il faut y sommer tout ce qui est
    #:   payé par côté : ``demi-spread + commission + slippage estimé``. Pour
    #:   l'EUR/USD, un spread affiché de 1 pip vaut 0.86 bps, soit 0.43 bps de
    #:   demi-spread, plus ~0.2-0.5 bps de commission ECN.
    #:
    #: Ne sont **pas** modélisés : le financement overnight (le manque le plus
    #: sérieux — les positions sont tenues ~2 jours, donc le swap s'applique à
    #: presque chaque trade), l'impact de marché, les commissions forfaitaires
    #: par ticket, et le slippage d'exécution.
    spread_bps: float = 1.0
    execution_lag: int = 1
    #: Probabilité au-delà de laquelle on prend une position (en valeur absolue
    #: d'edge). 0.02 => il faut P > 0.52 pour être long.
    edge_threshold: float = 0.02
    max_position: float = 1.0
    initial_balance: float = 10_000.0


@dataclass(frozen=True)
class DataConfig:
    symbol: str = "EUR/USD"
    interval: str = "1day"
    outputsize: int = 2000
    provider: Literal["yahoo", "twelvedata", "alphavantage", "csv", "synthetic"] = "yahoo"
    csv_path: str | None = None
    cache_path: str = "market_cache.db"
    #: Durée de vie du cache. Sans TTL, un cache SQLite fige les données à jamais.
    cache_ttl_hours: float = 12.0
    #: Utiliser la clôture **ajustée** (dividendes et splits réintégrés).
    #: Indispensable dès qu'un actif distribue : sur SPY, 2005-2026, la clôture
    #: brute donne +536 % contre +843 % ajusté. Ignorer les dividendes revient à
    #: amputer la prime de risque qu'on cherche justement à mesurer.
    adjusted: bool = True
    #: Lu depuis l'environnement — jamais écrit dans le code source.
    api_key_env: str = "TWELVEDATA_API_KEY"

    @property
    def api_key(self) -> str | None:
        return os.environ.get(self.api_key_env)


@dataclass(frozen=True)
class Config:
    data: DataConfig = field(default_factory=DataConfig)
    label: LabelConfig = field(default_factory=LabelConfig)
    split: SplitConfig = field(default_factory=SplitConfig)
    model: ModelConfig = field(default_factory=ModelConfig)
    backtest: BacktestConfig = field(default_factory=BacktestConfig)

    def to_dict(self) -> dict:
        return asdict(self)
