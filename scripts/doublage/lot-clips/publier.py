#!/usr/bin/env python3
"""Publie de nouvelles vidéos — création de lignes, pas remplacement.

À la différence des scripts de doublage, qui rattachent une variante à une
vidéo existante, celui-ci fait entrer six vidéos inédites dans le fil :
dépôt du mp4 et de sa vignette, puis insertion dans `videos`.

Idempotent : une unité dont la référence de verset est déjà publiée par ce
compte est sautée, pour qu'un second passage ne crée pas de doublon.
"""
import argparse
import json
import os
import pathlib
import subprocess
import sys
import urllib.request
import uuid

URL = "https://ilqzmpcmahxxnbdrugyt.supabase.co"
UID = "17a9bf8f-e809-4892-ab3b-78013d239e66"
COURRIEL = "mrkolosal+selah-lumiere@gmail.com"
MENTION_IA = "— visuel généré par IA"


def appel(methode, chemin, corps=None, entetes=None, anon=""):
    req = urllib.request.Request(URL + chemin, data=corps, method=methode)
    req.add_header("apikey", anon)
    for k, v in (entetes or {}).items():
        req.add_header(k, v)
    try:
        with urllib.request.urlopen(req, timeout=300) as r:
            return r.status, r.read()
    except urllib.error.HTTPError as e:
        return e.code, e.read()


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--videos", required=True)
    ap.add_argument("--mot-de-passe", required=True)
    a = ap.parse_args()

    anon = os.environ["ANON"]
    videos = pathlib.Path(a.videos)
    ici = pathlib.Path(__file__).parent
    unites = {k: v for k, v in json.load(open(ici / "narrations-fr.json")).items()
              if not k.startswith("_")}

    code, corps = appel("POST", "/auth/v1/token?grant_type=password",
                        json.dumps({"email": COURRIEL, "password": a.mot_de_passe}).encode(),
                        {"Content-Type": "application/json"}, anon)
    if code != 200:
        sys.exit(f"connexion refusée : {corps[:200]}")
    jeton = json.loads(corps)["access_token"]
    auth = {"Authorization": "Bearer " + jeton}

    code, corps = appel("GET", f"/rest/v1/videos?select=verse_ref&author_id=eq.{UID}",
                        None, auth, anon)
    deja = {v["verse_ref"] for v in json.loads(corps)}

    faits, sautes, echecs = 0, 0, []
    for u, bloc in sorted(unites.items()):
        if bloc["verset_fr"] in deja:
            sautes += 1
            continue
        mp4 = videos / f"{u}.mp4"
        if not mp4.exists():
            echecs.append(f"{u} : vidéo absente")
            continue
        jpg = mp4.with_suffix(".jpg")
        if not jpg.exists():
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", "6", "-i", str(mp4),
                            "-frames:v", "1", "-q:v", "4", str(jpg)], check=True)
        duree = int(float(subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration",
             "-of", "csv=p=0", str(mp4)],
            capture_output=True, text=True, check=True).stdout))

        cle = uuid.uuid4()
        chemins, erreur = {}, None
        for ext, fichier, mime in (("mp4", mp4, "video/mp4"), ("jpg", jpg, "image/jpeg")):
            chemin = f"{UID}/{cle}.{ext}"
            code, corps = appel("POST", f"/storage/v1/object/videos/{chemin}",
                                fichier.read_bytes(),
                                {**auth, "Content-Type": mime, "cache-control": "3600"}, anon)
            if code >= 300:
                erreur = f"{u} dépôt {ext} : {code} {corps[:120]}"
                break
            chemins[ext] = chemin
        if erreur:
            echecs.append(erreur)
            print(erreur, flush=True)
            continue

        code, corps = appel(
            "POST", "/rest/v1/videos",
            json.dumps({
                "author_id": UID,
                "storage_path": chemins["mp4"],
                "thumb_path": chemins["jpg"],
                "caption": f"{bloc['legende']} {MENTION_IA}",
                "verse_ref": bloc["verset_fr"],
                "type": bloc["type"],
                "duration_s": duree,
            }).encode(),
            {**auth, "Content-Type": "application/json", "Prefer": "return=minimal"}, anon)
        if code >= 300:
            echecs.append(f"{u} insertion : {code} {corps[:160]}")
            print(echecs[-1], flush=True)
            continue
        faits += 1
        print(f"{u} publiée — {bloc['verset_fr']}", flush=True)

    print(f"\n{faits} publiées, {sautes} déjà présentes, {len(echecs)} échecs")
    if echecs:
        sys.exit(1)


if __name__ == "__main__":
    main()
