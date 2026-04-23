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

## Fonctionnalités livrées (v1.2)
- **Stock** : CRUD articles **+ photos base64** (miniatures 56×56 dans Stock, 48×48 en Mode Action, placeholder icône si pas de photo), score auto, décisions (GARDER/BAISSER/LIQUIDER/SUPPRIMER), règles 7/14/21 jours, repost automatique, compteur de reposts (force delete ≥3), flags "MAUVAISE ANNONCE" / "PRIX TROP ÉLEVÉ".
- **Ventes** : CA, profit, délai moyen, prix moyens par marque, historique **+ "Performances mensuelles" (12 derniers mois avec CA, ventes, délai, ROI %, meilleur mois mis en avant)**.
- **Sourcing** : analyse brand/catégorie/prix → verdict ACHAT FORT / ACHETER / NÉGOCIER / IGNORE.
- **Niches** : classement auto par marque + création manuelle EN TEST / ACTIVE.
- **Mode Action** : uniquement les actions urgentes avec miniatures.
- **Clients** : CRM pseudo/produit/statut + relance auto >24h.
- **Retours** : 4 raisons, impact score marque.
- **Dashboard** : KPIs + alertes globales.
- **Export CSV** : 3 boutons dans Plus (stock / ventes / retours), partage natif mobile ou téléchargement direct sur web.
- **Notifications locales** : permission à l'ouverture + notification immédiate si actions urgentes + rappel quotidien à 9h00 + rappel hebdo backup le dimanche 20h (mobile natif uniquement, web = no-op).
- **💾 Sauvegarde & Restauration (v1.2)** :
  - Export JSON complet `vinted-manager-backup-YYYY-MM-DD.json` (stock + ventes + clients + retours + niches, incluant les photos)
  - Partage natif mobile (iCloud, Drive, WhatsApp, mail…) ou téléchargement direct sur web
  - Restauration depuis fichier JSON avec choix "Fusionner" (par id) ou "Remplacer" tout
  - Validation du schéma (rejette les fichiers non Vinted Manager)
  - Use-case : changer de téléphone ou désinstaller l'app sans perdre de données
- **Saisons** auto + bonus/malus.
- **Reset** total des données.

## Dépendances ajoutées v1.2
`expo-document-picker` (en plus de v1.1 : `expo-image-picker`, `expo-notifications`, `expo-sharing`, `expo-file-system`)

## Integrations
Aucune (app 100 % locale AsyncStorage).

## Roadmap V2 (idées business)
- Photo par article (base64) pour rappel visuel
- Export CSV ventes/stock
- Notifications push pour actions urgentes
- Import auto via scraping Vinted (hors scope MVP)
