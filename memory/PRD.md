# Vinted Manager — PRD

## Vision
Outil mobile premium (Expo React Native) pour revendeurs Vinted. Objectif : **vendre plus vite, faire tourner le stock, éviter le stock mort, améliorer les annonces, apprendre des ventes et retours**. Pas de trading, pas de finance — 100 % reselling Vinted.

## Tech
- Expo Router (file-based), React Native, TypeScript
- AsyncStorage (persistence locale, pas de backend)
- Thème : noir profond (#050505) + néon vert (#39FF14), rouge (#FF3366), orange (#FF9900)
- Langue : FR

## Architecture
```
app/
  _layout.tsx                  # Stack racine + DataProvider
  (tabs)/
    _layout.tsx                # Bottom tabs
    index.tsx                  # Dashboard
    stock.tsx                  # Stock
    ventes.tsx                 # Ventes
    action.tsx                 # Mode Action
    plus.tsx                   # Menu secondaire
  stock-new.tsx (modal)
  sourcing.tsx (modal)
  niches.tsx (modal)
  clients.tsx (modal)
  retours.tsx (modal)
src/
  store/context.tsx            # État global + AsyncStorage
  store/storage.ts             # helpers persistence
  utils/logic.ts               # scoring, décisions, sourcing, niches
  components/                  # Card, Badge, Button, Input, StatCard, ModalScreen, ScreenHeader
  theme/colors.ts              # palette
```

## Fonctionnalités livrées (v2.0 — Décisions fiables)

### Moteur d'analyse hybride `analytics.ts` (NOUVEAU)
- **Dimension temps sécurisée** : `datePublication` → heures/jours depuis post, avec garde-fous (min 1h, min 1j, capping vues/h à 50 et fav/h à 5)
- **Phase "analyse en cours"** si publication < 2h → aucune décision forte (badge `ANALYSE` affiché)
- **Traction** : vues/h, fav/h, vues/j, fav/j, ratio favoris/vues (si vues >= 10 seulement)
- **Score hybride /100** : 60 pts heures (vues/h, fav/h, ratio) + 40 pts jours (vues/j, fav/j, vendu <3j), adaptation temporelle par phase, pénalité -20 si >5j sans vente, -5/retour sur la marque
- **Actions automatiques** :
  - 🔴 SUPPRIMER (>=21j ou score < 10)
  - 🔴 LIQUIDER (>=14j, ou >=7j faible traction, ou ancien + faible)
  - 🟠 BAISSE IMMÉDIATE (>5 fav sans vente >=2j)
  - 🟠 BAISSER (vues hautes peu fav, ou >=5j score faible)
  - 🟡 REPOST (peu vues bon ratio)
  - 🟢 GARDER (score >=50)
  - ⚪ ANALYSE (<2h)
- **Boost recommendation** 🟢/🟡/🔴 : conditions strictes (heures 2-24h, vues>=30, fav>=5, ratio>12%, score>=45, prix cohérent)
- **Sourcing amélioré** :
  - "DONNÉES INSUFFISANTES" si aucune vente historique
  - Filtre catégorie : Carhartt/Dickies/workwear/Levi's/Patagonia = +40, hoodie/leggings/SHEIN/Primark = -10
  - Score /100 = marge 40 + catégorie 40 + rotation 20
  - Verdicts : ACHETER > OK > NÉGOCIER > REFUSER (basé sur marge >10/>5/<5/<0)

### Dashboard enrichi
- **KPIs** : CA total, Bénéfice (+ROI%), Délai moyen, Stock bloqué
- **Décisions à prendre** : À baisser, À liquider, Boostables, Clients relance
- **Niches** : meilleure / pire marque
- **Actions prioritaires** : top 3 articles à traiter

### Garde-fous (tests 1 à 10)
- Vues = 0 → pas de crash, ratio non calculé
- Prix achat manquant → "Coût inconnu", pas de bénéfice
- Division par zéro → protégée (min 1h/1j)
- Aucune décision forte < 2h → badge ANALYSE
- Bénéfice jamais négatif si sellPrice > buyPrice
- CA toujours > 0 si vente enregistrée

### Import CSV (NOUVEAU)
- Bouton "Importer un CSV" dans Plus
- Colonnes : `nom,marque,categorie,date_publication,date_vente,prix_achat,prix_vente,frais,vues,favoris`
- Si `date_vente` présente → crée Vente, sinon Stock
- Dédupe automatique (nom+marque+prix+date)
- Lignes invalides ignorées sans planter
- Rapport détaillé : X ajoutés, Y ignorés

### UI Samsung
- Tab bar Android : hauteur 78px, padding-bottom 16px
- Scroll content padding-bottom 100px pour ne plus cacher les boutons

## Fonctionnalités v1.2 conservées
- Photos base64 articles, Export CSV, Notifications locales (quotidienne 9h + backup hebdo 20h dimanche), Sauvegarde/Restauration JSON complète avec fusion/remplacement.

## Dépendances
`expo-document-picker`, `expo-image-picker`, `expo-notifications`, `expo-sharing`, `expo-file-system`

## Integrations
Aucune (app 100 % locale AsyncStorage).

## Roadmap V2 (idées business)
- Photo par article (base64) pour rappel visuel
- Export CSV ventes/stock
- Notifications push pour actions urgentes
- Import auto via scraping Vinted (hors scope MVP)
