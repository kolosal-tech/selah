#!/usr/bin/env python3
"""Remplace les douze vidéos françaises publiées par leur nouvelle version.

Le français est la version d'origine : elle vit dans `videos.storage_path`,
pas dans `video_translations`. On dépose sous de nouveaux chemins, on
bascule les lignes, on vérifie que le remplacement est servi, et seulement
alors on supprime les anciens objets. Les nouveaux chemins évitent qu'un
cache serve encore l'ancienne bande son.

Les lignes `videos` étant conservées, les amens, prières et commentaires
déjà reçus restent attachés à leur vidéo.
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
    ap.add_argument("--videos", required=True, help="dossier des mp4 français")
    ap.add_argument("--mot-de-passe", required=True)
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

    code, corps = appel(
        "GET", f"/rest/v1/videos?select=id,verse_ref,storage_path,thumb_path"
               f"&author_id=eq.{UID}", None, auth, anon)
    lignes = {v["verse_ref"]: v for v in json.loads(corps)}

    anciens, poses, echecs = [], [], []
    for unite in sorted(p.stem for p in videos.glob("*.mp4")):
        ligne = lignes[ref_fr[unite]]
        mp4 = videos / f"{unite}.mp4"
        jpg = mp4.with_suffix(".jpg")
        if not jpg.exists():
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", "6", "-i", str(mp4),
                            "-frames:v", "1", "-q:v", "4", str(jpg)], check=True)

        cle = uuid.uuid4()
        chemins, erreur = {}, None
        for ext, fichier, mime in (("mp4", mp4, "video/mp4"), ("jpg", jpg, "image/jpeg")):
            chemin = f"{UID}/{cle}.{ext}"
            code, corps = appel("POST", f"/storage/v1/object/videos/{chemin}",
                                fichier.read_bytes(),
                                {**auth, "Content-Type": mime, "cache-control": "3600"}, anon)
            if code >= 300:
                erreur = f"{unite} dépôt {ext} : {code} {corps[:120]}"
                break
            chemins[ext] = chemin
        if erreur:
            echecs.append(erreur)
            print(erreur, flush=True)
            continue

        # `Prefer: return=representation` est indispensable : sans lui,
        # PostgREST répond 204 aussi bien quand il a modifié la ligne que
        # quand la RLS ne lui en a laissé aucune. Un 204 ne prouve rien ;
        # la ligne renvoyée, si.
        code, corps = appel(
            "PATCH", f"/rest/v1/videos?id=eq.{ligne['id']}",
            json.dumps({"storage_path": chemins["mp4"], "thumb_path": chemins["jpg"]}).encode(),
            {**auth, "Content-Type": "application/json",
             "Prefer": "return=representation"}, anon)
        modifiees = json.loads(corps or b"[]") if code < 300 else []
        if code >= 300 or not modifiees:
            echecs.append(f"{unite} bascule sans effet : {code} {corps[:160]}")
            print(echecs[-1], flush=True)
            continue
        if modifiees[0]["storage_path"] != chemins["mp4"]:
            echecs.append(f"{unite} bascule incohérente : {modifiees[0]['storage_path']}")
            print(echecs[-1], flush=True)
            continue

        poses.append(chemins["mp4"])
        for ancien in (ligne.get("storage_path"), ligne.get("thumb_path")):
            if ancien:
                anciens.append(ancien)
        print(f"{unite} remplacée", flush=True)

    if echecs:
        print(f"\n{len(echecs)} échec(s) — aucun ancien fichier supprimé")
        sys.exit(1)

    # On ne vérifie pas « la base sert quelque chose » — elle servait déjà
    # quelque chose avant. On vérifie que ce sont bien les NOUVEAUX chemins
    # qui sont en place, et qu'ils répondent.
    code, corps = appel("GET", f"/rest/v1/videos?select=storage_path&author_id=eq.{UID}",
                        None, auth, anon)
    en_base = {v["storage_path"] for v in json.loads(corps)}
    manquants = [c for c in poses if c not in en_base]
    if manquants:
        sys.exit(f"{len(manquants)} chemin(s) neuf(s) absent(s) de la base — rien supprimé")
    for chemin in poses:
        c, octets = appel("GET", f"/storage/v1/object/public/videos/{chemin}",
                          None, None, anon)
        if c != 200 or len(octets) < 100_000:
            sys.exit(f"remplacement non servi ({chemin}) — rien supprimé")
    print(f"\nles {len(poses)} nouvelles versions sont en base et servies")

    code, corps = appel("DELETE", "/storage/v1/object/videos",
                        json.dumps({"prefixes": anciens}).encode(),
                        {**auth, "Content-Type": "application/json"}, anon)
    print(f"{len(json.loads(corps))} anciens objets supprimés")


if __name__ == "__main__":
    main()
