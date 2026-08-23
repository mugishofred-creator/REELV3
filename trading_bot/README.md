# Probabilité calibrée d'un mouvement de marché

> ### ⚠️ Conclusion du projet : la stratégie directionnelle n'est PAS tradable
>
> Le résultat le plus prometteur — Sharpe 3,69 sur un panier FX — s'est révélé
> être un **artefact de microstructure**. Il s'effondre à −0,79 dès qu'on
> décale l'exécution d'une seule barre : tout le rendement était concentré sur
> le premier print après le signal, c'est-à-dire sur du bruit de clôture qu'on
> ne peut pas traiter. Voir la section 3 quinquies.
>
> Ce qui reste solide : la **méthodologie** (probabilités calibrées, walk-forward
> purgé, contrôles négatifs), l'événement `amplitude`, et surtout le mode
> `--allocation` — une stratégie **sans aucune prédiction** qui, elle, passe le
> test de décalage. Voir la section 10.

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

## 3 quinquies. Le contrôle qui a tout invalidé

Après le passage au panel, le résultat était très beau. En retirant les actifs
hors FX — dont le Sharpe était négatif dans **deux univers disjoints**, ce qui
justifiait l'ablation — on obtenait :

| Univers | AUC | Skill | Folds + | Sharpe @2bps | Annualisé |
|---|---|---|---|---|---|
| A, FX (6 paires) | 0,5558 | +0,0124 | 6/6 | **+3,69** | +13,4 % |
| B, FX (4 paires, **jamais vues**) | 0,5441 | +0,0085 | 5/6 | **+2,98** | +10,8 % |

Ça répliquait sur un univers hors-échantillon. Ça passait tous les contrôles
négatifs. Un Sharpe de 3,7 sur du FX quotidien — c'est précisément ce qui aurait
dû déclencher la méfiance, et le coefficient dominant la désignait : `ret_1` à
−0,19, soit du retour à la moyenne à un jour. **La signature exacte du bid-ask
bounce.**

### Le test

Un prix de clôture n'est pas une valeur exacte : c'est un print entaché de bruit
— rebond entre bid et ask, cotation périmée, horodatage flottant. Ce bruit crée
une autocorrélation négative **purement artificielle** : quand la clôture
enregistrée est trop basse par accident, la suivante « revient », et une
stratégie de retour à la moyenne encaisse un profit qui n'existe que dans les
données. On ne peut pas traiter à un prix erroné.

Un effet économique réel se déploie sur plusieurs jours et survit partiellement
à une barre de retard. Un artefact disparaît intégralement :

| Univers | lag=1 | **lag=2** | lag=3 |
|---|---|---|---|
| A, FX (6 paires) | +3,69 | **−0,79** | −0,48 |
| B, FX (4 paires) | +2,98 | **−0,32** | −0,26 |

Sans appel.

### La confirmation par le fournisseur

Même paire EUR/USD, deux sources indépendantes :

| Source | Autocorrélation lag-1 | lag-2 |
|---|---|---|
| Yahoo | **−0,0240** | −0,0010 |
| Alpha Vantage | −0,0050 | +0,0005 |

Un facteur 5 d'écart sur la même paire, la même période. Et les deux clôtures
diffèrent de **9 pips en médiane** (29 en moyenne), pour un mouvement quotidien
typique de 61 pips. Les fournisseurs ne cotent tout simplement pas la même
clôture — et le modèle apprenait le bruit de l'un d'eux.

### Pourquoi le test hors-univers ne l'avait pas vu

Parce que les univers A et B partagent **le même fournisseur de données**. Une
validation croisée entre actifs ne peut rien contre un biais commun à la source.
C'est la limite structurelle de ce type de test, et elle mérite d'être retenue :
*généraliser* n'est pas *être réel*.

### Le garde-fou, désormais systématique

`lag_robustness()` tourne à chaque exécution de `--panel` et affiche un verdict
explicite. Deux tests le verrouillent dans les deux sens : il doit rejeter un
artefact simulé, et accepter un effet persistant simulé.

```
--- ROBUSTESSE AU DÉCALAGE D'EXÉCUTION ---
     sharpe  annualisé  rendement
lag
1     1.014     0.0255     0.9624
2    -0.773    -0.0179    -0.3828
3    -0.368    -0.0090    -0.2149

>>> ALERTE : le résultat s'effondre dès qu'on saute une barre. NON TRADABLE.
```

**Règle générale : si le Sharpe ne survit pas au décalage, le résultat n'existe
pas, quelle que soit sa beauté.**

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


---

## 10. La gestion du risque est-elle un edge ?

Question posée directement, et la réponse tient en deux temps opposés.

### Non — pas sur un marché à espérance nulle. C'est un théorème.

Si le prix est une martingale, le **théorème d'arrêt optionnel** garantit que
*toute* règle d'arrêt — stop-loss, take-profit, sortie en temps — laisse
l'espérance strictement inchangée. Vérifié sur 60 000 trajectoires d'un marché
construit pour avoir `E[P_t] = P_0` exactement :

| Schéma | E[rendement] | Médiane | Pire 1 % | P(ruine) |
|---|---|---|---|---|
| Buy & hold, aucun stop | −0,035 % | −1,36 % | −31,4 % | — |
| Stop −2 % / Target +2 % | +0,007 % | −2,00 % | −3,9 % | — |
| Stop −1 % / Target +5 % | +0,007 % | −1,30 % | −3,1 % | — |
| Stop −5 % / Target +1 % | +0,005 % | **+1,30 %** | −6,6 % | — |
| Martingale (×2 après perte) | +22 % | **+112 %** | **−100 %** | **45,4 %** |
| Anti-martingale (×1,5) | −0,638 % | −11,6 % | −65,7 % | 0 % |

**Toutes les espérances sont nulles.** Seule la *forme* de la distribution
change — et les formes les plus séduisantes sont les pires. Un stop large avec
un objectif serré produit une médiane positive et un taux de réussite élevé :
c'est l'illusion du système gagnant. La martingale fait mieux encore, +112 % de
médiane… en détruisant 45 % des comptes.

Aucun dimensionnement ne transforme une espérance nulle en espérance positive.
Ajoutez les coûts, et tout devient strictement négatif.

### Oui — appliquée à une prime de risque réelle.

Là, il n'y a rien à prédire. Les actions et les obligations ont une espérance
positive parce qu'elles **rémunèrent un risque**, pas parce qu'on saurait quand
elles montent. La gestion du risque ne crée pas cette prime : elle en améliore
la restitution.

8 ETF (actions US/international/émergents, obligations long et moyen terme,
immobilier coté, or), 2005-2026, coûts 2 bps/côté, clôtures ajustées des
dividendes :

| Stratégie | Annualisé | Volatilité | Sharpe | DD max | Calmar |
|---|---|---|---|---|---|
| Buy & hold (dérive libre) | 9,49 % | 13,5 % | 0,739 | −37,8 % | 0,251 |
| Équipondéré, rebalancé 21j | 9,21 % | 13,1 % | 0,740 | −37,1 % | 0,248 |
| Parité de risque | 8,16 % | 9,1 % | **0,912** | **−24,2 %** | 0,337 |
| **Vol ciblée 10 %** | **9,91 %** | 11,1 % | 0,906 | −24,5 % | **0,405** |

Meilleur actif isolé : QQQ, Sharpe 0,702. Le portefeuille géré atteint **0,912**.
Et le ciblage de volatilité fait mieux **sur les deux axes** que le buy & hold :
plus de rendement (9,91 % contre 9,49 %) *et* un tiers de drawdown en moins
(−24,5 % contre −37,8 %). Calmar : 0,251 → 0,405, soit +61 %.

### Le rebalancement seul ne rapporte rien ici

À noter, parce que c'est souvent survendu : rebalancer vers des poids égaux
donne 9,21 % contre 9,49 % en laissant dériver. **La prime de rebalancement est
négative sur cette période** — vendre les actions qui montaient pour racheter
des obligations a coûté. Ce n'est pas de l'argent gratuit, c'est un pari sur le
retour à la moyenne entre classes d'actifs, et il n'a pas payé ici. Le gain
vient de la **pondération par le risque**, pas du rebalancement.

### Le contrôle décisif

Cette stratégie ne prédit rien à l'échelle de la barre. Elle doit donc être
insensible au décalage d'exécution — et elle l'est :

| lag | 1 | 2 | 3 | 5 |
|---|---|---|---|---|
| Sharpe (vol ciblée) | 0,906 | 0,867 | 0,866 | 0,839 |
| Sharpe (directionnelle, section 3 quinquies) | +3,69 | **−0,79** | −0,48 | — |

C'est la différence entre un rendement réel et un artefact de microstructure.

### Par sous-période

| Période | Buy & hold | Vol ciblée |
|---|---|---|
| 2005-2009 (crise) | +7,47 % · DD −37,8 % | **+9,59 % · DD −22,3 %** |
| 2010-2014 | +9,92 % · DD −9,2 % | +13,13 % · DD −11,9 % |
| 2015-2019 | +7,52 % · DD −12,4 % | +11,21 % · DD −14,5 % |
| 2020-2021 | **+13,82 %** · DD −19,7 % | +6,40 % · DD −20,3 % |
| 2022-2026 | +8,67 % · DD −25,6 % | +8,00 % · DD **−18,7 %** |

Le point faible est visible et connu : **2020-2021**. Après le krach de mars
2020, le ciblage de volatilité désendette et rate le rebond en V. C'est le coût
structurel de la méthode — elle protège des crises longues et se fait piéger par
les reprises brutales.

### Ce que ça vaut, honnêtement

Ce n'est pas une machine à gagner : c'est un portefeuille diversifié bien géré.
Le résultat — Sharpe 0,91, environ 10 %/an — est celui d'une allocation
classique correctement exécutée, et c'est exactement pour cela qu'il est
crédible. Il repose sur une prime de risque réelle, il survit aux coûts et au
décalage d'exécution, et il n'exige **aucune prédiction**.

Deux limites à garder en tête : la période 2005-2026 a été favorable aux actions
comme aux obligations, et la prime de risque peut ne pas se matérialiser sur
votre horizon. Le mode est un point de départ documenté, pas un conseil.

```bash
python -m trading_bot --allocation --spread-bps 2
```


---

## 11. Journal de recherche : sept pistes, un seul résultat significatif

Recherche systématique d'un edge, chaque piste soumise aux mêmes contrôles —
walk-forward purgé, coûts réels, décalage d'exécution, t-stat de Newey-West
corrigée du chevauchement des rendements.

| Piste | Signal réel ? | Robuste au décalage ? | t-stat | Verdict |
|---|---|---|---|---|
| Directionnel quotidien, panel 10 actifs | Apparent | **Non** (+3,69 → −0,79) | — | Artefact de microstructure |
| **Volatilité (`amplitude`)** | **Oui**, AUC 0,816 | **Oui** (0,816 → 0,805) | — | Réel, mais non monétisable |
| Prévision de vol pour dimensionner | R² 0,576 vs 0,456 | — | — | Dégrade le portefeuille |
| Momentum ETF sectoriels/pays | Oui, Sharpe 0,674 | Oui (0,674 → 0,620) | +3,41 | Gain en drawdown seulement |
| Momentum actions (116 titres) | Alpha +3,95 %/an | Oui (0,966 → 0,941) | **+1,32** | Non significatif |
| Carry FX (10 devises) | Sharpe 0,29 | — | **+1,46** | Non significatif |
| Combinaison des trois briques | — | — | +3,53 | Aucun gain matériel |

### Ce que chaque échec a appris

**La volatilité est réellement prédictible** — c'est le seul signal du projet à
passer tous les contrôles avec une marge confortable (AUC 0,816, stable jusqu'à
5 barres de décalage). Mais mieux la prévoir **dégrade** le portefeuille :
Sharpe 0,847 contre 0,902 pour une simple fenêtre glissante. Le gain de
précision porte sur des changements de régime brefs, dont l'exploitation coûte
plus en turnover qu'elle ne rapporte. *Un meilleur R² qui ne se traduit pas dans
le portefeuille ne vaut rien.*

**Le momentum sur actions** donne un alpha de +3,95 %/an contre le même univers
équipondéré — mais un t-stat de 1,32 après correction de Newey-White. Sur les
sous-périodes, il sous-performe dans 3 périodes sur 4 ; tout le résultat vient
de 2022-2026. Et l'univers lui-même souffre du **biais du survivant** : 116
sociétés encore grandes aujourd'hui, remontées jusqu'en 2009. La référence
équipondérée partage ce biais, ce qui neutralise l'essentiel — mais pas tout.

**Le carry FX** confirme la littérature : le classement par différentiel de taux
rapporte (+2,9 %/an) là où le panier équipondéré de devises perd (−0,9 %/an). La
prime existe donc bien. Elle est simplement trop faible pour être distinguable
du bruit — Sharpe 0,29 pour −37 % de drawdown, exactement le profil d'une prime
payée pour porter un risque de krach.

**La combinaison ne sauve rien.** Allocation et momentum sont corrélés à 0,76 :
ce sont deux façons de porter la même prime actions, pas deux paris. Le carry
est bien décorrélé (0,18) mais son espérance n'est pas établie. Meilleur mélange
obtenu : Sharpe 0,835 contre 0,822 pour l'allocation seule — du bruit.

### Le seul résultat statistiquement significatif

| | Annualisé | Sharpe | DD max | **t-stat** |
|---|---|---|---|---|
| **Allocation (parité de risque + vol ciblée)** | **+9,00 %** | 0,822 | −22,0 % | **+3,59** |
| Allocation + momentum | +8,34 % | 0,812 | **−18,6 %** | **+3,76** |

Et il ne s'agit pas d'un edge sur le marché : c'est la **prime de risque
elle-même**, correctement récoltée. Le t-stat de 3,59 dit que porter du risque
diversifié paie — pas qu'on sait prédire quoi que ce soit.

### Conclusion

Sept pistes, des contrôles identiques et sévères sur chacune. Les deux signaux
réellement présents dans les données — la volatilité et le classement par
momentum — **réduisent le risque sans augmenter le rendement**. Aucune
prédiction directionnelle n'a survécu.

C'est convergent avec quarante ans de littérature, et c'est la réponse honnête à
la question posée : sur des données quotidiennes publiques, avec des coûts
réalistes, l'edge exploitable est le contrôle du risque, pas la prévision.


---

## 12. « Va ailleurs » : quatre terrains hors du cadre quotidien

Après l'échec des sept premières pistes sur données quotidiennes classiques,
recherche sur des terrains structurellement différents. Mêmes contrôles.

### La décomposition nuit / jour — réelle, stable, et incapturable

99 actions, 2005-2026. Séparation du rendement en **nuit** (clôture → ouverture)
et **jour** (ouverture → clôture) :

| Segment | Annualisé | Volatilité | Sharpe |
|---|---|---|---|
| **Nuit** | **+10,37 %** | 11,0 % | **0,952** |
| Jour | +4,72 % | 14,4 % | 0,392 |
| Total | +15,47 % | 18,6 % | 0,867 |

Deux tiers du rendement se fabriquent pendant que les marchés sont fermés, pour
une volatilité moindre. Et c'est le résultat le plus **stable** de tout le
projet : la nuit rapporte entre +8,4 % et +20,7 % dans les cinq sous-périodes,
**jamais négative**.

Mais la capturer impose d'acheter à la clôture et vendre à l'ouverture, soit
**504 transactions par an** :

| Coût/côté | Coût annuel | Net annualisé | Sharpe |
|---|---|---|---|
| 0,5 bp | 2,52 % | +7,62 % | 0,723 |
| 1 bp | 5,04 % | +4,95 % | 0,494 |
| **2 bps** | **10,08 %** | **−0,21 %** | 0,036 |

Le buy & hold donne +15,47 % pour **zéro** transaction. L'anomalie est
strictement dominée par le fait de ne rien faire — et c'est probablement la
raison de son existence : elle rémunère précisément la friction qui empêche de
l'exploiter.

### Crypto — un marché plus jeune, pas plus exploitable

21 cryptos à univers fixe, 2019-2026, coûts 20 bps/côté. Référence : buy & hold
du même univers, qui porte le même (sévère) biais du survivant.

| Stratégie | Alpha/an | Beta | t-stat |
|---|---|---|---|
| Momentum 90j (saut 7j) | +10,2 % | 0,83 | **+0,69** |
| Momentum 180j | +0,6 % | 0,79 | +0,04 |
| Reversal 30j | +3,3 % | 0,82 | +0,21 |
| Reversal 7j | −6,7 % | 0,85 | −0,48 |

Aucun alpha significatif. Et en absolu, **aucune stratégie ne bat l'équipondéré
rebalancé** (+45,4 %/an). Le long/short est impossible à modéliser
honnêtement : shorter un actif qui fait ×100 dépasse −100 % de perte.

### Effets de calendrier — instables

| Fenêtre | Rendement moyen/jour | t-stat |
|---|---|---|
| Tour du mois (4 j) | +0,0587 % | +1,81 |
| Reste du mois | +0,0459 % | +2,74 |

Et par sous-période, l'effet s'inverse : +0,0040 %/j contre +0,0155 % pour le
reste en 2005-2009, +0,0165 % contre +0,0543 % en 2015-2019. Le « mardi » sort à
t = 2,29, mais sur cinq jours testés c'est un artefact de **tests multiples** —
le seuil corrigé serait bien plus élevé.

### Deux bugs statistiques trouvés en chemin

**Tester la moyenne des résidus donne toujours zéro.** Les résidus d'une
régression OLS avec constante sont orthogonaux à l'intercept par construction.
Cette erreur a produit des t-stats de `+0.00` sur toutes les stratégies crypto
avant d'être repérée. Il faut la t-stat du **coefficient** alpha, via une
covariance sandwich de Newey-West.

**Une garde numérique absolue ne protège de rien.** Sur une stratégie
parfaitement colinéaire à sa référence — un simple levier, sans alpha possible —
les résidus tombent à 1e-17, la variance à 1e-32, et la t-stat sortait à
**+2,03 : « significatif »**, entièrement fabriqué par le bruit de virgule
flottante. Le critère de dégénérescence doit être **relatif** à l'échelle des
données. Verrouillé par un test.

### Bilan des onze pistes

Un seul résultat significatif dans tout le projet : l'allocation diversifiée
(t = +3,59), qui n'est pas un edge mais la prime de risque correctement
récoltée. Deux signaux réels et robustes — la volatilité et le classement par
momentum — qui réduisent le risque sans augmenter le rendement. Une anomalie
parfaitement stable, l'effet nuit, dont les coûts de transaction annulent
exactement le gain.

C'est une réponse, pas un échec : sur des données quotidiennes publiques, avec
des coûts réalistes et une méthodologie qui ne se ment pas, **l'edge exploitable
est le contrôle du risque**.


---

## 13. Le signal qui a passé quatre contrôles — et qui n'existe pas

Recherche d'un edge **conditionnel** : plutôt que « la direction est-elle
prédictible ? » (non, en moyenne), « existe-t-il des états où elle l'est ? ».
Motivée par le seul résultat solide du dépôt — on sait prédire la volatilité —
et par un mécanisme plausible : en panique, les ventes forcées créent des
dislocations économiques réelles, pas du bruit de cotation.

### Le point méthodologique préalable

Un modèle unique entraîné sur tous les états **moyenne les régimes** et efface
la structure recherchée. Mesuré : en découpant a posteriori les prédictions d'un
modèle global par quantile de volatilité, l'AUC reste plate entre 0.512 et
0.531. En entraînant **un modèle par régime**, la dispersion apparaît. Pour
détecter un edge conditionnel, le modèle doit avoir le droit de conditionner.

### Ce que le signal a franchi

| Contrôle | Régime « tendu » (80-95 %) | Régime « panique » (95-100 %) |
|---|---|---|
| **1. Décalage d'exécution** | ✗ +10,6 % → +0,4 % au j+3 (sur ETF) | **✓** +20,6 % au j+1, +21,7 % au j+5 |
| **2. Réplication, univers séparé** (99 actions, 511 223 lignes) | ✓ t = **+4,05** | ✓ t = +2,52 |
| **3. Biais du survivant** (+16 sociétés sinistrées) | ✗ **+13,6 % → −9,5 %**, t = −1,87 | **✓** +20,6 % → **+32,1 %**, t = **+2,80** |
| **4. Concentration par observation** | — | ⚠ top 1 % = 205 % du gain |
| **5. Concentration dans le TEMPS** | — | ✗✗ **voir ci-dessous** |

Le régime « tendu » était le résultat le plus significatif de toute la session —
t = 4,05 sur 59 740 observations, robuste au décalage. Ajouter 16 entreprises
sinistrées à 99 inverse le signe. Il ne mesurait que l'absence des cadavres.

Le régime « panique », lui, a franchi les trois premiers contrôles. Y compris le
plus dur : ajouter Fannie Mae, Freddie Mac, AIG, Citigroup, PG&E et First
Republic l'a **renforcé** (les rebonds de chat mort sont violents).

### Le cinquième contrôle

30 225 observations réparties sur **3 247 dates**. Combien de journées portent le
résultat ?

| Meilleures journées | Part du gain total |
|---|---|
| 1 | **32 %** |
| 3 | **76 %** |
| 5 | **108 %** |
| 10 | 164 % |

**Sans les 10 meilleures journées, le total passe de +38,4 à −24,4.** Journée
médiane : **+0,0001**. Journées gagnantes : **50,0 %** — pile ou face exact.

Les cinq meilleures journées : `2020-03-23`, `2020-03-12`, `2020-04-03`,
`2020-03-16`, `2020-03-25`. **Le krach Covid.**

Ce n'était pas une stratégie. C'était être long au creux de mars 2020.

### Pourquoi la t-stat ne l'avait pas vu

Newey-West suppose une variance finie et des queues raisonnables. Avec une
distribution où **une seule journée porte 32 % du total**, cette hypothèse ne
tient pas : le t de 2,80 est un artefact de l'approximation normale sur une
distribution qui ne s'y prête pas.

Et l'agrégation par actif entretenait l'illusion : 30 225 observations
paraissent un large échantillon, mais 500 actifs corrélés vus le même jour
restent **un seul événement**. C'est la distinction que
`event_concentration()` mesure, et que la concentration par observation
manquait.

### La leçon

**Quatre contrôles indépendants franchis, et le résultat n'existe pas.** Chacun
de ces contrôles avait, plus tôt dans ce projet, tué un faux signal. Aucun n'est
suffisant. Il en fallait un cinquième — et rien ne garantit qu'il n'en manque
pas un sixième.

C'est la vraie difficulté de ce métier : non pas trouver des motifs, mais
survivre à ses propres découvertes.


---

## 14. L'asymétrie des queues : la hausse est plus prédictible que la baisse

Question inédite, entre les deux précédentes. `direction` demande *dans quel
sens* — imprédictible. `amplitude` demande *de combien* sans le sens —
prédictible (AUC 0.816) mais non monétisable. Entre les deux : **P(forte
baisse)** et **P(forte hausse)**, mesurées séparément, en miroir exact.

Conception dictée par l'échec de la section 13 : on cherche explicitement un
effet à **nombreux événements**. Un seuil de queue à 12 % d'occurrence produit
des milliers d'épisodes sur vingt ans, pas une poignée de krachs.

### Le résultat contredit le folklore

20 ETF, 105 880 lignes, 81 880 prédictions hors-échantillon, seuil 5 % sur
10 jours, extrêmes mesurés intra-barre :

| | BAISSE | HAUSSE |
|---|---|---|
| AUC | 0,6710 | **0,7240** |
| Brier skill | +0,0225 | **+0,0489** |
| Taux de base | 0,1236 | 0,1222 |
| Folds positifs | 5/6 | **6/6** |

On répète que les krachs sont prévisibles. **Les données disent l'inverse : ce
sont les fortes hausses qui le sont, et de loin.** Les taux de base étant quasi
identiques, l'écart ne vient pas de la définition. Mécanisme plausible : les
rebonds partent d'états identifiables — volatilité élevée après une baisse —
alors que les krachs naissent dans le calme.

### Mais l'essentiel est de la volatilité déguisée

Corrélation entre les deux probabilités : **0,7355**. **54,1 %** de `p(hausse)`
est expliqué par `p(baisse)`. Les deux modèles mesurent d'abord la même chose —
la volatilité, qu'on savait déjà prédire.

Le signal brut `p(hausse) − p(baisse)` échoue en conséquence : la relation aux
rendements est **en U et non monotone** (Q1 +11,4 %, Q3 +7,3 %, Q5 +20,3 %).
Les deux extrêmes battent le milieu — signature d'un régime agité qui paie une
prime de risque, pas d'une information directionnelle. Concentration :
**événement unique**.

### Le résidu orthogonalisé — le meilleur signal directionnel du projet

En retirant de `p(hausse)` la part expliquée par `p(baisse)`, il reste la
composante **purement asymétrique** :

| Contrôle | Résultat |
|---|---|
| Décalage d'exécution | ✓ +2,9 % · +2,2 % · +2,8 % · +1,2 % (j+1 à j+5) |
| t-stat Newey-West | ⚠ **+2,12** — marginal |
| Concentration temporelle | ⚠ pas un événement unique, mais **69 % du gain sur 10 journées** (sur 4 094) |
| Monotonie des quintiles | ✗ Q2 décroche à +7,1 % |

C'est le signal directionnel le mieux tenu de tout le projet — et il reste
**non établi**. Trois réserves, dont une qui m'incombe :

1. Un `t` de 2,12 est marginal, et j'ai testé **le signal brut puis le
   résidu** sur les mêmes données. Deux essais, donc un seuil qui devrait
   monter.
2. 69 % du gain sur 0,24 % des journées reste un profil de loterie.
3. La non-monotonie interdit de dire que « plus le signal est fort, mieux
   c'est » — ce qu'on attendrait d'un vrai effet.

### Le diagnostic gradué

Ce cas a révélé que mon drapeau binaire `is_single_event` était trop grossier :
un total qui reste positif sans les dix meilleures journées ne le déclenche
pas, alors que 69 % du gain sur dix journées est clairement un profil de
loterie. `event_concentration()` gradue désormais — *réparti*, *concentré —
fragile*, *très concentré — profil de loterie*, *événement unique* — avec un
test qui reproduit exactement ce cas limite.
