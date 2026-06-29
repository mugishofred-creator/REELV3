# ============================================================
# COLAB - Clonage vocal XTTS-v2
# Usage : colle chaque bloc dans une cellule Colab séparée
# ============================================================


# ── CELLULE 1 : Installation ─────────────────────────────────
# Durée ~3 min la première fois

# !pip install TTS flask flask-cors pyngrok -q


# ── CELLULE 2 : Serveur Flask + XTTS-v2 ─────────────────────

import os
import io
import threading
from flask import Flask, request, send_file, jsonify
from flask_cors import CORS
from TTS.api import TTS

app = Flask(__name__)
CORS(app)

print("Chargement du modèle XTTS-v2 (~1.8 GB, ~2 min)...")
tts = TTS("tts_models/multilingual/multi-dataset/xtts_v2").to("cuda")
print("Modèle prêt.")

REFERENCE_PATH = "/content/reference_voice.wav"


@app.route("/status")
def status():
    return jsonify({
        "ok": True,
        "voice_ready": os.path.exists(REFERENCE_PATH)
    })


@app.route("/upload", methods=["POST"])
def upload():
    if "audio" not in request.files:
        return jsonify({"error": "Champ 'audio' manquant"}), 400
    request.files["audio"].save(REFERENCE_PATH)
    return jsonify({"ok": True, "message": "Échantillon enregistré"})


@app.route("/synthesize", methods=["POST"])
def synthesize():
    if not os.path.exists(REFERENCE_PATH):
        return jsonify({"error": "Aucun échantillon vocal. Lance /upload d'abord."}), 400

    data = request.get_json(force=True)
    text = (data.get("text") or "").strip()
    lang = data.get("language", "fr")

    if not text:
        return jsonify({"error": "Texte vide"}), 400
    if len(text) > 1000:
        return jsonify({"error": "Texte trop long (max 1000 caractères)"}), 400

    out_path = "/content/output.wav"
    tts.tts_to_file(
        text=text,
        speaker_wav=REFERENCE_PATH,
        language=lang,
        file_path=out_path,
    )
    return send_file(out_path, mimetype="audio/wav", as_attachment=False)


def _run():
    app.run(host="0.0.0.0", port=5000, debug=False, use_reloader=False)

threading.Thread(target=_run, daemon=True).start()
print("Serveur Flask démarré sur le port 5000")


# ── CELLULE 3 : Tunnel ngrok ─────────────────────────────────
# Crée un compte gratuit sur https://ngrok.com → copie ton authtoken

# from pyngrok import ngrok
# ngrok.set_auth_token("COLLE_TON_TOKEN_ICI")
# url = ngrok.connect(5000)
# print(f"\n{'='*50}")
# print(f"URL publique : {url}")
# print(f"Copie cette URL dans la PWA !")
# print(f"{'='*50}\n")
