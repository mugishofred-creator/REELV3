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

## 3 ter. Ce qui fait passer le bot au vert : la mutualisation

Sur un actif seul, en quotidien, la direction n'est pas prédictible. Ce n'est
pas un défaut de modèle mais un problème de **rapport signal/bruit par pari**,
et il n'a que deux issues :

1. augmenter l'edge par pari — c'est ce que tout le monde tente, et ce qui
   échoue sur EUR/USD ;
2. **augmenter le nombre de paris peu corrélés.** Loi fondamentale de la gestion
   active (Grinold) : ``IR ≈ IC × √breadth``. Un edge minuscule répété sur dix
   actifs produit un ratio que le même edge sur un seul ne produira jamais.

D'où `--panel` : **un seul** modèle entraîné sur tous les actifs empilés
(52 659 lignes contre 4 000), découpage train/test **par date** pour que tous les
actifs basculent ensemble, features en rang percentile calculées *par actif*
pour être comparables entre l'euro et le pétrole.

```bash
python -m trading_bot --panel --event direction --horizon 1 \
    --n-splits 6 --min-train-size 1200 --spread-bps 2 --fast
```

| | Un seul actif | **Panel mutualisé (10 actifs)** |
|---|---|---|
| AUC | 0.494 | **0.538** |
| Brier skill | −0.0008 | **+0.0048** |
| Folds positifs | 1/8 | **6/6** |
| Sharpe (2 bps) | négatif | **+1.06** |

### La sensibilité aux coûts décide de tout

L'edge est réel mais minuscule, et la stratégie tourne tous les jours. Le seuil
de rentabilité se situe vers **7–8 bps** :

| Spread | Rendement (21 ans) | Annualisé | Sharpe |
|---|---|---|---|
| 0 bp | +151 % | +4,1 % | +1,55 |
| 1 bp | +120 % | +3,5 % | +1,33 |
| 2 bps | +93 % | +2,9 % | +1,11 |
| 5 bps | +29 % | +1,1 % | +0,44 |
| 10 bps | −34 % | −1,8 % | −0,68 |

Ce tableau *est* le résultat. Un backtest sans lui ne veut rien dire.

### Ce que le modèle a appris, et à quel point c'est fragile

Coefficients dominants : `channel_pos_20` −0.62 (position haute dans le canal
20 jours → baisse plus probable) et `ret_1` −0.19, c'est-à-dire du **retour à la
moyenne court terme** ; puis `ret_20` +0.11, du **momentum moyen terme**. Deux
effets parmi les mieux documentés de la littérature — pas un motif exotique.

Mais l'ablation est sévère :

| Features | AUC | Skill | Folds + | Sharpe @2bps |
|---|---|---|---|---|
| 30 (complet) | 0.5375 | +0.0048 | 6/6 | **+1.06** |
| 6 (minimal) | 0.5317 | +0.0032 | 6/6 | +0.38 |
| sans `channel_pos`/`bb_position` | 0.5204 | +0.0004 | 4/6 | **−0.23** |

Le cœur de l'edge tient à la position dans l'intervalle récent : le retirer tue
tout. Et l'écart entre 6 et 30 features (0.38 → 1.06 de Sharpe) est exactement
là où se loge le sur-apprentissage. **Le chiffre robuste est 0.38, pas 1.06.**

### Pourquoi ce n'est pas une fuite

`test_negative_control_on_the_panel_path` fait tourner le chemin panel entier
sur dix marches aléatoires indépendantes : AUC 0.498, skill +0.0000, Sharpe
+0.000. Le découpage par date, la purge et le portefeuille sont sains — le
résultat sur données réelles vient des données, pas de la mécanique.

### Les horizons plus longs ne marchent pas

Testé aussi, sans succès : h=5 (skill −0.0002, 2 folds sur 6) et h=21
(+0.0007, 3 sur 6). L'edge est concentré sur l'horizon quotidien.

## 3 quater. Le financement overnight : mesuré, et négligeable ici

Dernier biais optimiste du backtest. Avec une détention d'environ deux jours et
27 % d'exposition, le swap s'applique à presque chaque trade — le risque étant
qu'une stratégie prenant structurellement le même côté sur une devise à taux bas
paie le différentiel jour après jour.

Source : **BIS `WS_CBPOL`**, taux directeur quotidien de chaque banque centrale
depuis 2005, sans clé d'API, taux négatifs inclus (−0,75 % en CHF, −0,10 % en
JPY). Convention, pour une position longue de BASE/QUOTE :

```
carry annualisé = taux_BASE − taux_QUOTE       # long EUR/USD : perçoit EUR, paie USD
coût            = position × carry × jours_calendaires / 365
```

Le prorata suit les jours **calendaires** : vendredi → lundi porte trois jours,
pas un. Et attention, `JPY=X`, `CHF=X`, `CAD=X` sont des paires **USD/xxx** —
inverser le sens inverserait le carry sur trois des six paires.

### Le résultat

| Coût/côté | Sans financement | Avec financement |
|---|---|---|
| 1 bp | +111,5 % · Sharpe 1,28 | +111,7 % · Sharpe 1,28 |
| 2 bps | +85,7 % · Sharpe 1,06 | +85,9 % · Sharpe 1,06 |
| 5 bps | +25,8 % · Sharpe 0,40 | +25,9 % · Sharpe 0,40 |

**Financement cumulé sur 16 ans : +0,07 %.** Contre 26 % de coûts d'exécution.
Un facteur 370.

### Pourquoi — et pourquoi ce n'est pas généralisable

Parce que la stratégie est **symétrique**. Elle est mean-reverting : elle prend
les deux côtés à parts quasi égales, donc le carry s'annule.

| | Position moyenne signée | Position moyenne \|absolue\| | % de jours long |
|---|---|---|---|
| EUR/USD | +0,0007 | 0,301 | 47,9 % |
| USD/JPY | −0,0174 | 0,313 | 46,4 % |
| GBP/USD | −0,0033 | 0,242 | 48,2 % |

Biais net moyen sur le panier : **0,029** (0 = symétrique, 1 = toujours le même
côté). Le financement est négligeable **par conséquence de la nature du signal**,
pas par chance. Une stratégie de trend-following ou de carry, qui tiendrait des
positions directionnelles pendant des mois, verrait un résultat radicalement
différent — et le module est là pour le mesurer.

### Par régime de taux

Le différentiel moyen varie d'un facteur 5 entre 2020-21 et 2022-26. Le
financement ne bouge pas pour autant.

| Période | \|Δtaux\| moyen | Brut | Exécution | Financement | **Net** | Sharpe |
|---|---|---|---|---|---|---|
| 2010-2014 | 0,91 % | +0,96 % | −0,30 % | −0,00 % | **+0,65 %** | 0,93 |
| 2015-2019 | 1,03 % | +5,56 % | −1,65 % | +0,01 % | **+3,85 %** | 1,16 |
| 2020-2021 (taux zéro) | 0,34 % | +3,50 % | −1,68 % | −0,01 % | **+1,77 %** | 0,58 |
| 2022-2026 (cycle de hausse) | 1,73 % | +5,10 % | −1,12 % | +0,00 % | **+3,94 %** | 1,57 |

(annualisé, coût d'exécution à 2 bps/côté)

La stratégie tient dans les quatre régimes. Le point faible n'est pas le carry :
c'est **2020-2021**, où les coûts d'exécution mangent la moitié du brut.

```bash
python -m trading_bot --panel --spread-bps 2      # financement inclus par défaut
python -m trading_bot --panel --no-funding        # pour comparer
```

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
