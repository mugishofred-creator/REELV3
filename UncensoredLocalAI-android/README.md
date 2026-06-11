# Uncensored Local AI — Android build (v1.2.0)

APK Android prêt à installer (release, arm64-v8a).

## Téléchargement
Ouvre ce fichier sur GitHub puis bouton **Download** :
`UncensoredLocalAI-v1.2.0-arm64-v8a.apk`

## Installation (Android)
1. Télécharge l'APK sur le téléphone.
2. Ouvre-le (Fichiers → Téléchargements).
3. Autorise « Installer depuis des sources inconnues » si demandé.
4. Installe, puis ouvre l'app **Uncensored Local AI**.

> Compatibilité : téléphones **arm64-v8a** (quasi tous les modèles 2018+).

## Améliorations incluses
- **+4 modèles uncensored** plus puissants (Llama 3.1 8B Abliterated, Dolphin 3.0,
  Gemma 2 9B Abliterated, Qwen2.5-Coder 14B « MOST POWERFUL »).
- **Taille de contexte configurable** (jusqu'à 8192, défaut 4096) au lieu de 1024.
- **Mode serveur distant** : Réglages → *Remote Server* → l'app devient un client
  léger vers n'importe quel serveur compatible OpenAI (vLLM, llama.cpp server,
  Ollama, LM Studio…). Même les téléphones bas de gamme utilisent un gros modèle.

Le détail des changements de code est dans `improvements.diff`.
