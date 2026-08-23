# Probabilité calibrée d'un mouvement de marché

Estimation de **P(mouvement)** à partir de plusieurs indicateurs, avec la seule
chose qui rende ce nombre exploitable : une mesure de sa qualité face à une
baseline honnête.

```bash
pip install -r trading_bot/requirements.txt

# Fonctionne sans clé : Alpha Vantage sert un historique FX complet en démo.
python -m trading_bot --symbol EUR/USD --event amplitude --horizon 5 \
    --barrier-pct 0.010 --n-splits 8 --min-train-size 750

# Twelve Data, ou série synthétique aux propriétés connues :
export TWELVEDATA_API_KEY="votre_clé" && python -m trading_bot --provider twelvedata ...
python -m trading_bot --provider synthetic --event amplitude --horizon 5
```

Le code de sortie vaut `0` si le modèle bat la baseline, `2` sinon — utilisable
tel quel en CI pour détecter une dégradation.

---

## 1. Choisir l'événement — la décision qui détermine tout

`P = 0.62` n'a aucun sens tant qu'on n'a pas dit *de quoi*. Les trois familles
disponibles ne sont pas également prédictibles, et l'écart est énorme :

| `--event` | Question | Prédictibilité |
|---|---|---|
| `direction` | P(clôture t+h > clôture t) | Très faible. Taux de base ~50 %, edge réel de l'ordre du point de pourcentage. |
| `amplitude` | P(\|variation\| > seuil sur h barres) | **La meilleure.** La volatilité est fortement autocorrélée. |
| `triple_barrier` | P(+k·ATR avant −k·ATR sous h barres) | Faible (directionnel), mais directement actionnable : c'est un trade avec take-profit et stop-loss. |

**Le piège de définition qui coûte le plus cher.** Pour `amplitude`, exprimer le
seuil en multiples d'ATR *courant* semble élégant — c'est comparable entre
actifs. Mais cela transforme la question en « la volatilité future
dépassera-t-elle la volatilité récente ? », c'est-à-dire un ratio quasi
imprédictible : la normalisation annule exactement le clustering de volatilité
qu'on cherche à exploiter. Mesuré sur la série synthétique, même pipeline et
mêmes features :

| Seuil | AUC hors-échantillon |
|---|---|
| `--barrier-pct 0.005` (absolu) | **0.616** |
| `--barrier-atr 2.0` (normalisé) | 0.522 |

Le test `test_atr_threshold_destroys_the_signal_it_should_capture` verrouille ce
constat.

## 2. Combiner les indicateurs : log-odds, pas vote

L'agrégation finale décompose la probabilité en deux rôles séparés :

```
logit(P) = logit(fréquence récente)  +  w × évidence(indicateurs)
              ↑ le NIVEAU                    ↑ l'ÉCART
```

- Le **niveau** vient d'une baseline climatologique glissante — la fréquence de
  l'événement sur les 250 dernières barres résolues.
- L'**écart** vient du modèle, centré de sorte qu'un modèle sans information
  laisse la baseline strictement intacte.

Pourquoi cette séparation : sous dérive du taux de base, un modèle entraîné sur
une période où l'événement arrive 44 % du temps prédira ~44 % dans une période
où il arrive 86 %, **alors même que son classement reste bon**. Mesuré sur le
fold concerné, l'ancrage adaptatif fait passer le Brier de 0.260 à 0.173 (la
baseline étant à 0.170) et l'ECE global de 0.171 à 0.058.

Le facteur `w = --evidence-weight` (0.5 par défaut) amortit l'évidence. En
finance le signal est faible et instable, et le log-loss punit très durement une
forte conviction fausse : mieux vaut sous-affirmer.

À l'opposé, un **vote OU** sur des signaux catégoriels — ce que faisait le bot
d'origine — ne peut pas produire une probabilité. Il sature : avec 10 signaux
indépendants disant « buy » 30 % du temps chacun, `P(au moins un) = 1 − 0.7¹⁰ =
97 %`, quelle que soit la conviction réelle.

## 3. Comment on sait que ça marche

Un pipeline financier n'a pas de vérité terrain sur données réelles. La seule
façon de le valider est de lui donner un problème dont la réponse est connue
d'avance. Le générateur synthétique produit une série GARCH : **volatilité
groupée** (donc `amplitude` doit être prédictible) et **signes i.i.d.** (donc
`direction` ne doit *pas* l'être).

| Contrôle | AUC | Brier skill | Sharpness | Verdict |
|---|---|---|---|---|
| Négatif — `direction` | 0.492 | −0.0013 | 0.039 | Ne trouve rien, **et ne prétend rien** |
| Positif — `amplitude` | 0.616 | **+0.0097** | 0.095 | Trouve le signal |

Le contrôle négatif est le plus important des deux : **un skill positif sur
`direction` en synthétique signalerait une fuite de données.** C'est le test qui
garde le pipeline honnête, et il tourne à chaque `pytest`.

## 3 bis. Résultats sur données réelles

EUR/USD quotidien, 5 000 barres (2007-06 → 2026-08), walk-forward purgé en
8 folds, ~4 100 prédictions hors-échantillon. Aucun réglage n'a été refait pour
ces données — c'est la configuration par défaut.

| Événement | AUC | Brier skill | LogLoss skill | ECE | Verdict |
|---|---|---|---|---|---|
| `direction` h=1 | 0.494 | −0.0008 | −0.0006 | 0.045 | Rien. Et le modèle **ne prétend rien** (sharpness 0.032). |
| `triple_barrier` h=10, ±1.5 ATR | 0.492 | −0.0002 | −0.0002 | 0.081 | Rien. |
| **`amplitude` h=5, seuil 1 %** | **0.680** | **+0.050** | **+0.038** | 0.051 | **Signal réel**, positif dans 7 folds sur 8. |

L'AUC de `amplitude` est remarquablement stable quel que soit le seuil — 0.694 à
0.5 %, 0.680 à 1 %, 0.679 à 1.5 %, 0.679 à 2 % — ce qui est la signature d'un
effet réel plutôt que d'un artefact de seuil.

C'est exactement la hiérarchie annoncée en section 1, et elle vaut d'être
formulée nettement : **sur du FX quotidien, la direction n'est pas prédictible,
l'amplitude l'est.** Deux événements bien posés sur les mêmes données, avec les
mêmes indicateurs, séparés par 0.19 point d'AUC.

### Le piège du P&L

Sur `direction`, le backtest affiche −6,1 % contre −14,4 % pour le buy & hold,
et annonce donc « bat le buy & hold ». **C'est un artefact.** Avec une exposition
de 7 % du temps et un Sharpe de −0.27, la stratégie ne prédit rien : elle est
simplement à plat pendant qu'un actif baisse. Le pipeline affiche désormais un
avertissement explicite quand un backtest est présenté alors que la probabilité
n'a aucun skill.

Le juge de paix est la section « qualité de la probabilité », jamais le P&L.

## 4. Évaluer une probabilité, pas une décision

`classification_report` juge un choix binaire après seuillage ; il ne dit rien
de la qualité du nombre. Ici on utilise des **règles de score propres** — celles
qu'on minimise en annonçant sa vraie croyance :

- **Brier** et **log-loss**, chacun rapporté face à sa baseline, avec un *skill
  score* (`1 − score/baseline` : >0 = utile, ≤0 = inutile).
- **Courbe de fiabilité** : quand j'annonce 0.60, ça arrive combien de fois ?
- **ECE**, l'écart de calibration moyen pondéré.
- **Sharpness** : l'écart-type des probabilités. Lu *avec* la fiabilité — être
  toujours à la baseline est parfaitement calibré et parfaitement inutile.
- **AUC**, qui mesure le classement seul et reste bon même quand la probabilité
  est fausse (`test_overconfidence_is_punished_even_when_ranking_is_right`).

**Le détail par fold n'est pas décoratif.** Sous dérive du taux de base,
l'agrégat trompe : sur la série synthétique, des folds à AUC 0.60–0.69
s'agrègent en un AUC pooled de 0.53 parce que le regroupement mélange des
populations non comparables.

## 5. Ce qui garantit l'absence de fuite

| Mécanisme | Fichier |
|---|---|
| Walk-forward **purgé** : retire du train tout échantillon dont le *label* se résout après le début du test, plus un embargo | `model.py::purged_walk_forward` |
| Calibration sur une tranche **postérieure au train et antérieure au test** | `model.py::walk_forward_predict` |
| Scaler et imputer **dans le pipeline** — ajustés sur le train du fold uniquement | `model.py::build_estimator` |
| Baseline calculée sur les seuls labels **déjà résolus** (décalage de l'horizon) | `model.py::rolling_baseline` |
| Labels `NaN` quand l'horizon dépasse les données | `labels.py` |
| Décalage d'exécution dans le backtest | `backtest.py::run` |

Ces garanties sont testées mécaniquement, pas seulement documentées :
`trading_bot/tests/test_no_lookahead.py` vérifie notamment qu'une feature
calculée en `t` **ne change pas** quand on tronque la série après `t` — la
définition opérationnelle de la causalité.

```bash
python -m pytest trading_bot/tests -q      # 29 tests
```

## 6. Features : 30 grandeurs stationnaires, aucune redondante

Rendements multi-horizons, ratios de volatilité, ATR relatif, RSI centré,
position dans les bandes de Bollinger, position dans le canal, skew/kurtosis,
autocorrélation, Hurst et entropie **en fenêtre glissante**, saisonnalité
hebdomadaire.

Deux absences volontaires :

- **`log(price)`, `sqrt(price)`, `price³`.** Ce sont des transformations
  monotones du prix : tout modèle à base d'arbres y est invariant — mêmes
  découpes, zéro information — et elles font compter la même évidence plusieurs
  fois. En log-odds, un indicateur à 0.55 dupliqué 5 fois produit une confiance
  de 0.73 sans une once d'information nouvelle.
- **Le volume sur le FX.** Twelve Data ne le fournit pas ; la colonne serait
  constamment nulle. Elle n'est ajoutée que si elle contient vraiment quelque
  chose.

**Transformation par rang glissant** (`--feature-transform rank`, par défaut) :
chaque feature est remplacée par son rang percentile dans sa propre fenêtre
passée. C'est la parade à un mode d'échec très concret des arbres — quand le
régime de test sort du support d'entraînement, un arbre ne peut pas extrapoler,
prédit une constante, et le classement bascule sur des features de bruit.
Mesuré : dans le fold où la volatilité médiane double, l'AUC du modèle tombe à
**0.21** (inversion complète) alors que la feature brute `vol_10` vaut 0.84 sur
ce même fold.

## 7. Ce qui a été retiré, et pourquoi

| Retiré | Raison |
|---|---|
| **SMOTE** | Force le taux de base à 50/50. Pour une décision c'est discutable ; pour une probabilité c'est disqualifiant — la sortie ne correspond plus à aucune fréquence observable. |
| **`train_test_split(shuffle=True)`** | Met du futur dans le train sur une série temporelle. |
| Vote OU sur des signaux `'buy'`/`'sell'` | Détruit la probabilité et sature vers 1 à mesure qu'on ajoute des modèles. |
| 10 modèles empilés (RF, GB, SVC, XGB, Ada, LR, LGBM, CatBoost, LSTM, CNN, « VAE ») | Sur ~1 500 barres et un signal faible, la capacité n'est pas le facteur limitant. La régression logistique calibrée bat le GBM ici (skill +0.0039 contre −0.0008). |
| Clustering (GMM, HMM, DBSCAN, Spectral) mappé sur des ordres | Les labels de cluster sont arbitraires : rien ne fait du cluster 0 un signal d'achat, et le numéro change à chaque `fit`. |
| Métriques `nolds` sur la série entière | Constantes sur toutes les lignes (variance nulle) *et* rétrospectives. Remplacées par des versions en fenêtre glissante. |
| `exp(price)` | `math.exp(750)` déborde — inutilisable hors FX. |
| Colonnes placeholder 100 % `NaN` | Le `dropna(subset=features)` vidait le DataFrame : tous les modèles sortaient sur `if data.empty` sans jamais s'entraîner. |
| Clé API en dur | Lue depuis `TWELVEDATA_API_KEY`. Un test échoue si une clé réapparaît dans le source. |
| Cache SQLite sans expiration | TTL de 12 h par défaut. |

## 8. Le backtest, et ses limites

Il n'utilise que les probabilités **hors-échantillon**, décale l'exécution d'une
barre, et paie le spread sur le *turnover*. La taille de position est
proportionnelle à l'edge — c'est le seul usage qui exploite réellement une
probabilité calibrée : 0.51 et 0.65 ne méritent pas la même exposition.

Il reste une **démonstration de la qualité de la probabilité**, pas un système
de trading. Il ignore le slippage, l'impact de marché, le financement overnight,
et suppose une exécution parfaite à la clôture. Pour `--event amplitude` il est
désactivé : l'événement ne porte pas de direction.

## 9. Honnêteté sur les réglages

`--evidence-weight 0.5` et le choix de la régression logistique ont été retenus
en comparant les résultats hors-échantillon sur la série synthétique. C'est déjà
une forme de sélection : répéter l'opération sur vos propres données, en gardant
la configuration qui donne le meilleur skill, réintroduit exactement le biais
que tout le reste du pipeline cherche à éliminer. Si vous devez régler quelque
chose, gardez une période finale que vous ne regardez qu'une seule fois.

**Attente réaliste.** Sur de l'EUR/USD quotidien, `--event direction` ne
produira très probablement aucun skill, et c'est le résultat correct : il n'y a
presque rien à extraire. `--event amplitude` est le terrain où ces indicateurs
ont une vraie chance. Un pipeline qui vous annonce un edge directionnel massif
sur du FX quotidien a une fuite, pas une découverte.
