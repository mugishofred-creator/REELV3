# JobPilot

Agent IA de recherche d'emploi — mobile (Expo React Native).

JobPilot t'évite de spammer 200 offres pour zéro réponse. Il :

- score chaque offre par rapport à ton profil (heuristique + OpenAI),
- filtre les fausses annonces (MLM, ghost jobs) avant d'y perdre du temps,
- rédige des lettres personnalisées par entreprise via GPT,
- pilote une file de candidatures avec quota anti-spam,
- suit ton pipeline type CRM (envoyée → vue → entretien → offre),
- propose des relances au bon moment,
- analyse tes résultats pour te dire où concentrer tes efforts.

## Stack

- Expo 54 / React Native 0.81 / Expo Router (typed routes)
- AsyncStorage (aucune donnée n'est envoyée ailleurs qu'à OpenAI)
- OpenAI Chat Completions API (`gpt-4o-mini` par défaut, `gpt-4o`, `gpt-4.1-mini`)
- Design système maison — thème sombre néon (`src/theme/colors.ts`)

## Setup

```sh
cd frontend
yarn install
yarn start
```

Depuis l'app :

1. **Profil** → renseigne tes infos, ton pitch et tes compétences
2. **Profil → CV** → importe ton CV PDF
3. **Profil → IA** → colle ta clé OpenAI (récupérée sur `platform.openai.com`)
4. **Offres** → filtres, tape "Tout ajouter à la file"
5. **Campagne** → "Postuler maintenant" en 1 tap

Aucune candidature n'est envoyée sans ta validation.

## Structure

```
frontend/
├── app/                       # écrans Expo Router
│   ├── (tabs)/                # onglets : index, offres, campagne, suivi, profil
│   ├── offer-detail.tsx       # modal détail offre + génération IA
│   ├── filters.tsx            # modal filtres
│   ├── letter-editor.tsx      # modal éditeur de lettre type
│   ├── application-detail.tsx # modal suivi d'une candidature
│   ├── profile-edit.tsx       # modal profil
│   └── ai-settings.tsx        # modal clé OpenAI + modèle
└── src/
    ├── store/                 # context + AsyncStorage
    ├── utils/                 # seed, format, match, letter, ai, notifications
    ├── components/            # Card, Button, Chip, OfferCard, ...
    └── theme/                 # colors, radius, spacing, shadow
```
