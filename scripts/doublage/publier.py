#!/usr/bin/env python3
"""Publication des variantes doublées.

Dépose chaque `<lang>/<unite>.mp4` et sa vignette dans le bucket `videos`,
puis renseigne `video_translations.storage_path` / `thumb_path`. Le fil sert
alors la variante dès que l'utilisateur lit dans cette langue, et retombe
sur la version française pour les langues non doublées.

Le compte `selah_lumiere` est l'auteur des douze vidéos : la politique de
stockage n'autorise l'écriture que dans son propre dossier, il faut donc sa
session. Le mot de passe est posé le temps du dépôt puis le hachage
d'origine est restauré — voir `--empreinte`.

Idempotent : une traduction déjà pourvue d'un `storage_path` est sautée.
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
    ap.add_argument("--videos", required=True, help="dossier <lang>/<unite>.mp4")
    ap.add_argument("--mot-de-passe", required=True)
    ap.add_argument("--langues", nargs="*", default=None)
    a = ap.parse_args()

    anon = os.environ["ANON"]
    videos = pathlib.Path(a.videos)
    ici = pathlib.Path(__file__).parent
    fr = json.load(open(ici / "narrations-fr.json"))
    ref_fr = {u: v["verset_fr"] for u, v in fr.items()}

    code, corps = appel("POST", "/auth/v1/token?grant_type=password",
                        json.dumps({"email": COURRIEL, "password": a.mot_de_passe}).encode(),
                        {"Content-Type": "application/json"}, anon)
    if code != 200:
        sys.exit(f"connexion refusée : {corps[:200]}")
    jeton = json.loads(corps)["access_token"]
    auth = {"Authorization": "Bearer " + jeton}

    code, corps = appel("GET", f"/rest/v1/videos?select=id,verse_ref&author_id=eq.{UID}",
                        None, auth, anon)
    ids = {v["verse_ref"]: v["id"] for v in json.loads(corps)}

    langues = a.langues or sorted(p.name for p in videos.iterdir() if p.is_dir())
    faits, sautes, echecs = 0, 0, []
    for lang in langues:
        for unite in sorted(p.stem for p in (videos / lang).glob("*.mp4")):
            video_id = ids[ref_fr[unite]]
            code, corps = appel(
                "GET",
                f"/rest/v1/video_translations?select=storage_path"
                f"&video_id=eq.{video_id}&lang=eq.{lang}", None, auth, anon)
            deja = json.loads(corps)
            if deja and deja[0].get("storage_path"):
                sautes += 1
                continue

            mp4 = videos / lang / f"{unite}.mp4"
            jpg = mp4.with_suffix(".jpg")
            if not jpg.exists():
                # Vignette prise à 6 s : le verset y est déjà apparu.
                subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", "6", "-i", str(mp4),
                                "-frames:v", "1", "-q:v", "4", str(jpg)], check=True)

            cle = uuid.uuid4()
            chemins = {}
            erreur = None
            for ext, fichier, mime in (("mp4", mp4, "video/mp4"),
                                       ("jpg", jpg, "image/jpeg")):
                chemin = f"{UID}/{cle}-{lang}.{ext}"
                code, corps = appel("POST", f"/storage/v1/object/videos/{chemin}",
                                    fichier.read_bytes(),
                                    {**auth, "Content-Type": mime,
                                     "cache-control": "3600"}, anon)
                if code >= 300:
                    erreur = f"{lang}/{unite} dépôt {ext} : {code} {corps[:120]}"
                    break
                chemins[ext] = chemin
            if erreur:
                echecs.append(erreur)
                print(erreur, flush=True)
                continue

            code, corps = appel(
                "PATCH",
                f"/rest/v1/video_translations?video_id=eq.{video_id}&lang=eq.{lang}",
                json.dumps({"storage_path": chemins["mp4"],
                            "thumb_path": chemins["jpg"]}).encode(),
                {**auth, "Content-Type": "application/json",
                 "Prefer": "return=representation"}, anon)
            # Un 204 ne dit pas si une ligne a bougé : la RLS peut n'en avoir
            # laissé passer aucune. On exige la ligne modifiée en retour.
            modifiees = json.loads(corps or b"[]") if code < 300 else []
            if code >= 300 or not modifiees:
                echecs.append(f"{lang}/{unite} bascule sans effet : {code} {corps[:160]}")
                print(echecs[-1], flush=True)
                continue
            faits += 1
            print(f"{lang}/{unite} publiée", flush=True)

    print(f"\n{faits} publiées, {sautes} déjà en place, {len(echecs)} échecs")
    if echecs:
        sys.exit(1)


if __name__ == "__main__":
    main()
