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

## Fonctionnalités livrées (v1.0)
- **Stock** : CRUD articles, score auto (favoris/vues/profit/jours/défaut/saison/retours), décisions (GARDER/BAISSER/LIQUIDER/SUPPRIMER), règles strictes 7/14/21 jours, repost automatique, compteur de reposts (force delete ≥3), flags "MAUVAISE ANNONCE" / "PRIX TROP ÉLEVÉ".
- **Ventes** : CA, profit, délai moyen, prix moyens par marque, historique.
- **Sourcing** : analyse brand/catégorie/prix → verdict ACHAT FORT / ACHETER / NÉGOCIER / IGNORE avec ratio, profit estimé, historique marque.
- **Niches** : classement auto par marque (score = profit/délai × taux de succès), création manuelle avec statut EN TEST / ACTIVE.
- **Mode Action** : uniquement les actions urgentes (supprimer, baisser prix avec suggestion, reposter, relancer clients).
- **Clients** : CRM pseudo/produit/statut (intéressé/négociation/sans réponse), relance auto si sans réponse >24h.
- **Retours** : raisons (mauvaise taille, défaut non mentionné, non conforme, changement d'avis), impact score marque.
- **Dashboard** : KPIs profit, articles, capital bloqué, actions urgentes, meilleure/pire niche, alertes globales ("TU ACHÈTES MAL", "MAUVAISE DESCRIPTION", "ANNONCES FAIBLES").
- **Saisons** auto-détectées (été/hiver/toute), bonus si en saison, malus si hors saison.
- **Reset** total des données depuis Plus.

## Integrations
Aucune (app 100 % locale AsyncStorage).

## Roadmap V2 (idées business)
- Photo par article (base64) pour rappel visuel
- Export CSV ventes/stock
- Notifications push pour actions urgentes
- Import auto via scraping Vinted (hors scope MVP)
