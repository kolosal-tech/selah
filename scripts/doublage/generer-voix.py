#!/usr/bin/env python3
"""Synthèse des 120 narrations (12 unités × 10 langues).

La clé API est fournie explicitement par l'environnement du processus. Elle
n'est jamais recherchée dans les autres processus, écrite sur disque ni
affichée.

Idempotent : un fichier déjà produit n'est pas régénéré. Relancer après
une coupure reprend là où ça s'était arrêté.
"""
import concurrent.futures as cf
import json
import os
import pathlib
import subprocess
import sys
import urllib.request

ICI = pathlib.Path(__file__).parent
SORTIE = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else ICI / "voix")
LANGUES = ["fr", "en", "es", "pt", "it", "de", "ru", "ar", "zh", "ja", "ko"]
CJC = {"zh", "ja", "ko"}

# Deux voix, en alternance selon l'unité — c'est l'alternance des
# scénarios français, qui donne au fil une respiration entre les vidéos.
SARAH = "EXAVITQu4vr4xnSDxMaL"   # féminine, posée, rassurante
ROGER = "CwhRBWXzGAHq8TQ4Fs17"   # masculine, chaude, ample
GENRE = {"01": SARAH, "02": ROGER, "03": ROGER, "04": SARAH,
         "05": ROGER, "06": SARAH, "07": ROGER, "08": ROGER,
         "09": SARAH, "10": ROGER, "11": SARAH, "12": ROGER}

MODELE = "eleven_v3"  # seul modèle couvrant les onze écritures visées


def cle() -> str:
    """Retourne uniquement une clé explicitement fournie à ce processus."""
    key = os.environ.get("ELEVENLABS_API_KEY", "")
    if key.startswith("sk_"):
        return key
    sys.exit("ELEVENLABS_API_KEY est requise dans l'environnement du processus.")


CLE = cle()


def synthetiser(lang: str, unite: str, texte: str) -> str:
    dest = SORTIE / lang / f"{unite}.mp3"
    if dest.exists() and dest.stat().st_size > 10_000:
        return f"{lang}/{unite} déjà là"
    dest.parent.mkdir(parents=True, exist_ok=True)
    req = urllib.request.Request(
        f"https://api.elevenlabs.io/v1/text-to-speech/{GENRE[unite]}?output_format=mp3_44100_128",
        data=json.dumps({
            "text": texte,
            "model_id": MODELE,
            "language_code": lang,
            "voice_settings": {
                "stability": 0.5,
                "similarity_boost": 0.75,
                "use_speaker_boost": True,
                # Les écritures CJC sont déjà denses : les accélérer rend
                # la diction hachée.
                "speed": 1.05 if lang in CJC else 1.1,
            },
        }).encode(),
        headers={"xi-api-key": CLE, "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=180) as r:
            octets = r.read()
    except urllib.error.HTTPError as e:
        return f"{lang}/{unite} ÉCHEC {e.code} {e.read()[:160].decode(errors='replace')}"
    if len(octets) < 10_000:
        return f"{lang}/{unite} ÉCHEC audio trop court ({len(octets)} o)"
    dest.write_bytes(octets)
    return f"{lang}/{unite} ok ({len(octets) // 1024} Ko)"


taches = []
for lang in LANGUES:
    d = json.load(open(ICI / "lang" / f"{lang}.json"))
    for unite in sorted(d):
        taches.append((lang, unite, d[unite]["narration"]))

print(f"{len(taches)} narrations à synthétiser")
echecs = []
# Quatre requêtes en vol : assez pour tenir la cadence, assez peu pour ne
# pas déclencher la limitation de débit.
with cf.ThreadPoolExecutor(max_workers=4) as ex:
    for r in ex.map(lambda t: synthetiser(*t), taches):
        print(r, flush=True)
        if "ÉCHEC" in r:
            echecs.append(r)

print(f"\n{len(taches) - len(echecs)}/{len(taches)} produites")
if echecs:
    print("Échecs :")
    for e in echecs:
        print(" -", e)
    sys.exit(1)
