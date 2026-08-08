#!/usr/bin/env python3
"""Contrôle des variantes doublées avant publication.

Une vidéo peut être présente et pourtant inutilisable : rendu interrompu,
piste audio muette, dimensions inattendues, poids au-delà de ce que le
bucket accepte. Ce contrôle regarde chaque fichier plutôt que de faire
confiance au fait qu'il existe.
"""
import json
import pathlib
import subprocess
import sys

LIMITE_OCTETS = 50 * 1024 * 1024   # plafond du bucket `videos`
DUREE_MAX = 300                     # plafond de la table `videos`


def sonde(f: pathlib.Path) -> dict:
    r = subprocess.run(
        ["ffprobe", "-v", "error", "-print_format", "json",
         "-show_format", "-show_streams", str(f)],
        capture_output=True, text=True)
    if r.returncode or not r.stdout:
        return {}
    return json.loads(r.stdout)


def niveau_moyen(f: pathlib.Path) -> float:
    """Volume moyen en dB. Une piste muette sort très bas (< -60 dB)."""
    r = subprocess.run(
        ["ffmpeg", "-hide_banner", "-i", str(f), "-af", "volumedetect",
         "-f", "null", "/dev/null"],
        capture_output=True, text=True)
    for ligne in r.stderr.splitlines():
        if "mean_volume:" in ligne:
            return float(ligne.split("mean_volume:")[1].split("dB")[0])
    return -99.0


def main() -> None:
    base = pathlib.Path(sys.argv[1])
    fichiers = sorted(base.rglob("*.mp4"))
    print(f"{len(fichiers)} fichiers à contrôler\n")
    defauts = []
    durees = {}
    for f in fichiers:
        nom = f"{f.parent.name}/{f.stem}"
        meta = sonde(f)
        if not meta:
            defauts.append(f"{nom} : illisible (rendu interrompu ?)")
            continue
        duree = float(meta["format"]["duration"])
        octets = int(meta["format"]["size"])
        video = next((s for s in meta["streams"] if s["codec_type"] == "video"), None)
        audio = next((s for s in meta["streams"] if s["codec_type"] == "audio"), None)
        durees.setdefault(f.parent.name, []).append(duree)

        if not video or (video["width"], video["height"]) != (1080, 1920):
            defauts.append(f"{nom} : dimensions inattendues")
        if not audio:
            defauts.append(f"{nom} : aucune piste audio")
        elif (db := niveau_moyen(f)) < -45:
            defauts.append(f"{nom} : audio quasi muet ({db:.0f} dB)")
        if duree > DUREE_MAX:
            defauts.append(f"{nom} : {duree:.0f}s au-delà du plafond de {DUREE_MAX}s")
        if octets > LIMITE_OCTETS:
            defauts.append(f"{nom} : {octets // 1024 // 1024} Mo au-delà du plafond du bucket")

    for lang, ds in sorted(durees.items()):
        print(f"{lang}: {len(ds):2d} vidéos, {min(ds):.0f}–{max(ds):.0f}s")

    print()
    if defauts:
        print(f"{len(defauts)} défaut(s) :")
        for d in defauts:
            print(" -", d)
        sys.exit(1)
    print(f"Les {len(fichiers)} vidéos sont lisibles, sonores et dans les limites.")


if __name__ == "__main__":
    main()
