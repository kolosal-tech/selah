#!/usr/bin/env python3
"""Montage des variantes doublées : même film, autre langue.

Reprend trait pour trait le montage français (`remonter-textes.sh`) :
cinq images fixes animées d'un mouvement propre, fondus enchaînés, voile,
verset puis clôture dans le tiers haut, nappe d'ambiance creusée sous la
voix par un compresseur à chaîne latérale. Seuls changent la narration et
les planches de texte, composées dans l'écriture de la langue.

La durée n'est pas figée : elle suit celle de la narration synthétisée,
qui varie d'une langue à l'autre. Les durées de plan sont donc recalculées
à chaque montage, jamais recopiées du français.
"""
import argparse
import json
import pathlib
import subprocess
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent))
import planches  # noqa: E402

ICI = pathlib.Path(__file__).parent
SEED = pathlib.Path(
    "/private/tmp/claude-501/-Users-mskolosalgmail-com-Developer-TIKTOK-CRETIEN"
    "/669ffbf0-ffec-48af-9e68-1a0ada9af60d/scratchpad/seed"
)
IMAGES = SEED / "images"
NAPPE = pathlib.Path(__file__).parents[2] / "public/sons/ambiance-selah.m4a"

FONDU = 1.1     # recouvrement entre deux plans
AMORCE = 2.0    # image seule avant la voix
QUEUE = 5.0     # nappe tenue seule après la voix
FPS = 30
HAUT = "H*0.155"  # le texte vit au-dessus du rail d'actions de l'application

POIDS = {5: [0.235, 0.175, 0.165, 0.175, 0.250],
         4: [0.280, 0.210, 0.205, 0.305]}


def duree(fichier: pathlib.Path) -> float:
    return float(subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "csv=p=0", str(fichier)],
        capture_output=True, text=True, check=True).stdout)


def mouvement(rang: int, frames: int) -> str:
    """Un geste de caméra par plan : avancée, recul, panoramique, diagonale."""
    return {
        1: f"z='1.02+0.13*on/{frames}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'",
        2: f"z='1.17-0.13*on/{frames}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'",
        3: f"z='1.12':x='(iw-iw/zoom)*(on/{frames})':y='ih/2-(ih/zoom/2)'",
        4: (f"z='1.05+0.10*on/{frames}':x='(iw-iw/zoom)*(0.15+0.7*on/{frames})'"
            f":y='(ih-ih/zoom)*(0.2+0.6*on/{frames})'"),
        5: f"z='1.16-0.14*on/{frames}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'",
    }[rang]


def voile(dossier: pathlib.Path) -> pathlib.Path:
    """Sombre en haut (le texte y est posé), clair au centre, sombre en bas."""
    p = dossier / "voile.png"
    if p.exists():
        return p
    dossier.mkdir(parents=True, exist_ok=True)
    haut, bas = dossier / ".haut.png", dossier / ".bas.png"
    subprocess.run(["magick", "-size", "1080x780",
                    "gradient:rgba(2,6,23,0.62)-rgba(2,6,23,0.06)", str(haut)], check=True)
    subprocess.run(["magick", "-size", "1080x1140",
                    "gradient:rgba(2,6,23,0.06)-rgba(2,6,23,0.80)", str(bas)], check=True)
    subprocess.run(["magick", str(haut), str(bas), "-append", str(p)], check=True)
    haut.unlink(missing_ok=True)
    bas.unlink(missing_ok=True)
    return p


def monter(lang: str, unite: str, verset: str, reference: str, cloture: str,
           voix: pathlib.Path, dest: pathlib.Path, travail: pathlib.Path) -> str:
    plans = [k for k in "12345" if (IMAGES / f"unite-{unite}-{k}.png").exists()]
    if len(plans) < 4:
        return f"{lang}/{unite} ignorée : {len(plans)} image(s)"

    pv = travail / f"verset-{lang}-{unite}.png"
    pc = travail / f"cloture-{lang}-{unite}.png"
    planches.planche_verset(verset, reference, pv, lang)
    planches.planche_cloture(cloture, pc, lang)

    dv = duree(voix)
    total = AMORCE + dv + QUEUE
    n = len(plans)
    somme = total + (n - 1) * FONDU
    durees = [somme * p for p in POIDS[n]]
    decalages, acc = [], 0.0
    for i in range(n - 1):
        acc += durees[i] - FONDU
        decalages.append(round(acc, 3))
    arret_verset = round(min(15.5, total - 8.5), 3)
    apparition_cloture = round(total - 6.2, 3)
    sortie_video = round(total - 0.9, 3)
    reprise_nappe = round(AMORCE + dv + 0.3, 3)

    entrees, chaine = [], ""
    for j, k in enumerate(plans):
        d = round(durees[j], 3)
        f = int(round(d * FPS))
        entrees += ["-loop", "1", "-t", str(d), "-i", str(IMAGES / f"unite-{unite}-{k}.png")]
        chaine += (f"[{j}:v]scale=2160:3840:force_original_aspect_ratio=increase,"
                   f"crop=2160:3840,zoompan={mouvement(j + 1, f)}:d=1:s=1080x1920:fps={FPS},"
                   f"setsar=1,eq=saturation=1.05:contrast=1.03[p{j}];")
    precedent = "p0"
    for j in range(1, n):
        chaine += (f"[{precedent}][p{j}]xfade=transition=fade:duration={FONDU}"
                   f":offset={decalages[j - 1]}[x{j}];")
        precedent = f"x{j}"

    chaine += f"[{n}:v]scale=1080:1920[voile];[{precedent}][voile]overlay=0:0[v1];"
    chaine += (f"[{n + 1}:v]format=rgba,fade=in:st=1.6:d=1.2:alpha=1,"
               f"fade=out:st={arret_verset}:d=1.0:alpha=1[verset];")
    chaine += f"[v1][verset]overlay=(W-w)/2:{HAUT}[v2];"
    chaine += f"[{n + 2}:v]format=rgba,fade=in:st={apparition_cloture}:d=1.1:alpha=1[clot];"
    chaine += f"[v2][clot]overlay=(W-w)/2:{HAUT}[v3];"
    chaine += (f"[v3]fade=in:st=0:d=0.8,fade=out:st={sortie_video}:d=0.9,"
               f"trim=0:{total},setpts=PTS-STARTPTS[v];")

    # La voix pilote elle-même le creux de la nappe : dupliquée, une copie
    # audible, une copie prolongée de silence qui alimente la chaîne
    # latérale. Sans ce prolongement, la nappe s'arrêterait avec la parole.
    ms = int(AMORCE * 1000)
    chaine += f"[{n + 4}:a]adelay={ms}|{ms},volume=1.0,asplit=2[vo][pilote0];"
    chaine += f"[pilote0]apad=whole_dur={total}[pilote];"
    chaine += f"[{n + 3}:a]volume=0.40[pad0];"
    chaine += ("[pad0][pilote]sidechaincompress=threshold=0.22:ratio=2:attack=15"
               ":release=520:makeup=1[pad1];")
    rampe = f"0.95+0.65*(t-1.85)/{round(reprise_nappe - 1.85, 3)}"
    chaine += (f"[pad1]volume='if(lt(t,1.85),1.30,if(lt(t,{reprise_nappe}),{rampe},2.20))'"
               ":eval=frame[pad2];")
    chaine += ("[pad2][vo]amix=inputs=2:duration=first:weights='1 1':normalize=0,"
               f"atrim=0:{total},asetpts=PTS-STARTPTS,alimiter=limit=0.94,"
               f"afade=in:st=0:d=1.2,afade=out:st={round(total - 1.4, 3)}:d=1.4[a]")

    dest.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        ["ffmpeg", "-v", "error", "-y", *entrees,
         "-loop", "1", "-i", str(voile(travail)),
         "-loop", "1", "-i", str(pv),
         "-loop", "1", "-i", str(pc),
         "-stream_loop", "-1", "-i", str(NAPPE),
         "-i", str(voix),
         "-filter_complex", chaine,
         "-map", "[v]", "-map", "[a]", "-t", str(total),
         "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p",
         "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", str(dest)],
        check=True,
    )
    return f"{lang}/{unite} {duree(dest):.1f}s {dest.stat().st_size // 1024} Ko"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--voix", required=True, help="dossier des mp3 <lang>/<unite>.mp3")
    ap.add_argument("--sortie", required=True, help="dossier des mp4 produits")
    ap.add_argument("--travail", required=True, help="dossier des planches")
    ap.add_argument("--langues", nargs="*", default=None)
    a = ap.parse_args()

    trad = json.load(open(ICI.parent / "traductions-videos.json"))["videos"]
    fr = json.load(open(ICI / "narrations-fr.json"))
    ref_fr = {u: v["verset_fr"] for u, v in fr.items()}
    voix_dir, sortie, travail = (pathlib.Path(a.voix), pathlib.Path(a.sortie),
                                 pathlib.Path(a.travail))
    langues = a.langues or ["en", "es", "pt", "it", "de", "ru", "ar", "zh", "ja", "ko"]

    for lang in langues:
        textes = json.load(open(ICI / "lang" / f"{lang}.json"))
        for unite in sorted(textes):
            voix = voix_dir / lang / f"{unite}.mp3"
            if not voix.exists():
                print(f"{lang}/{unite} : narration absente, ignorée", flush=True)
                continue
            dest = sortie / lang / f"{unite}.mp4"
            if dest.exists() and dest.stat().st_size > 100_000:
                print(f"{lang}/{unite} déjà monté", flush=True)
                continue
            bloc = trad[ref_fr[unite]][lang]
            print(monter(lang, unite, bloc["verset"], bloc["ref"],
                         textes[unite]["cloture"], voix, dest, travail), flush=True)


if __name__ == "__main__":
    main()
