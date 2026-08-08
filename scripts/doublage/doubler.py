#!/usr/bin/env python3
"""Doublage des 12 vidéos d'amorçage en 11 langues.

Étapes (idempotentes, reprises sans double travail) :
  --etape voix      TTS ElevenLabs par unité et par langue
  --etape montage   re-rendu vidéo avec texte gravé traduit
  --etape publier   dépôt bucket + mise à jour video_translations
  --dry-run         montre ce qui serait fait, n'appelle rien

Voir README.md pour la chaîne complète et les préalables.
"""
import argparse
import json
import os
import pathlib
import subprocess
import sys
import urllib.request

ICI = pathlib.Path(__file__).parent
URL_SUPABASE = "https://ilqzmpcmahxxnbdrugyt.supabase.co"
UID = "17a9bf8f-e809-4892-ab3b-78013d239e66"
LANGUES = ["en", "es", "pt", "it", "de", "ru", "ar", "he", "zh", "ja", "ko"]
RTL = {"ar", "he"}

# Voix ElevenLabs. « Narrateur FR Neutre » est la voix clonée déjà utilisée
# pour les douze narrations françaises : la garder sur toutes les langues
# donne une continuité de timbre d'une version à l'autre.
NARRATEUR = "ZnEAYHVx6a73EykQUbao"
VOIX = {"femme": os.environ.get("ELEVEN_VOIX_FEMME", NARRATEUR),
        "homme": os.environ.get("ELEVEN_VOIX_HOMME", NARRATEUR)}

# eleven_multilingual_v2 ne couvre PAS l'hébreu (vérifié sur list_models) ;
# eleven_v3 couvre les douze langues du réseau. Un seul modèle partout évite
# une différence de timbre entre l'hébreu et le reste.
MODELE = "eleven_v3"
GENRE = {"01": "femme", "02": "homme", "03": "homme", "04": "femme",
         "05": "homme", "06": "femme", "07": "homme", "08": "homme",
         "09": "femme", "10": "homme", "11": "femme", "12": "homme"}


def cle_eleven() -> str:
    cle = os.environ.get("ELEVENLABS_API_KEY", "")
    if not cle.startswith("sk_"):
        sys.exit(
            "ELEVENLABS_API_KEY absente ou invalide (doit commencer par sk_).\n"
            "Renseigne-la dans ~/.claude/.env.mcp puis relance."
        )
    return cle


def charger_narrations() -> dict:
    p = ICI / "narrations.json"
    if not p.exists():
        sys.exit(
            "narrations.json manquant : les 12 narrations doivent être "
            "traduites dans les 11 langues avant de générer les voix."
        )
    return json.load(open(p))


def etape_voix(dry: bool) -> None:
    narrations = charger_narrations()
    cle = None if dry else cle_eleven()
    for unite, langs in narrations.items():
        for lang in LANGUES:
            texte = langs[lang]["narration"]
            sortie = ICI / "voix" / lang / f"{unite}.mp3"
            if sortie.exists():
                continue
            if dry:
                print(f"[dry] TTS {unite}/{lang} ({len(texte)} car.)")
                continue
            sortie.parent.mkdir(parents=True, exist_ok=True)
            voix = VOIX[GENRE[unite]]
            req = urllib.request.Request(
                f"https://api.elevenlabs.io/v1/text-to-speech/{voix}",
                data=json.dumps({
                    "text": texte,
                    "model_id": MODELE,
                    "language_code": lang,
                    "voice_settings": {"stability": 0.45, "similarity_boost": 0.8},
                }).encode(),
                headers={"xi-api-key": cle, "Content-Type": "application/json"},
                method="POST",
            )
            with urllib.request.urlopen(req) as r:
                sortie.write_bytes(r.read())
            print(f"voix {unite}/{lang} ok")


def etape_montage(dry: bool) -> None:
    # Le rendu réutilise le moteur shell éprouvé : un appel par langue,
    # avec blocs (verset, référence, clôture) injectés depuis les JSON.
    script = ICI / "monter-lang.sh"
    if not script.exists():
        sys.exit("monter-lang.sh manquant (généré avec narrations.json).")
    for lang in LANGUES:
        if dry:
            print(f"[dry] montage {lang}")
            continue
        subprocess.run([str(script), lang], check=True)


def etape_publier(dry: bool) -> None:
    if dry:
        print("[dry] publication bucket + video_translations")
        return
    sys.exit("publication : à lancer via publier-lang.py (session selah_lumiere).")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--etape", choices=["voix", "montage", "publier"], required=True)
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()
    {"voix": etape_voix, "montage": etape_montage, "publier": etape_publier}[a.etape](a.dry_run)


if __name__ == "__main__":
    main()
