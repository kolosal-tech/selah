#!/usr/bin/env python3
"""Série « Respire » : le verset seul, sans photographie.

Les autres vidéos du fil reposent sur des images ou des plans filmés. Ici
il n'y en a pas : le fond est peint par ffmpeg — un dégradé qui dérive
lentement, teinté par unité — et toute l'attention va au verset et à la
voix. C'est une respiration entre deux exhortations, et cela ne consomme
aucune image, ce qui permet d'en produire autant qu'on veut.

La musique n'est pas la nappe d'ambiance du reste du fil : trois pièces
composées pour Selah, alternées d'une unité à l'autre.

  produire.py voix    → synthèse ElevenLabs
  produire.py montage → mp4
"""
import json
import os
import pathlib
import re
import subprocess
import sys
import urllib.request

ICI = pathlib.Path(__file__).parent
RACINE = ICI.parent
sys.path.insert(0, str(RACINE))
import planches  # noqa: E402

MUSIQUES = pathlib.Path(
    "/private/tmp/claude-501/-Users-mskolosalgmail-com-Developer-TIKTOK-CRETIEN"
    "/3fcd7fcd-b48c-4c85-b619-291004cf5fba/scratchpad/musique"
)

SARAH = "EXAVITQu4vr4xnSDxMaL"
ROGER = "CwhRBWXzGAHq8TQ4Fs17"
VOIX = {"19": SARAH, "20": ROGER, "21": SARAH, "22": ROGER, "23": SARAH, "24": ROGER}

AMORCE = 2.5    # le fond respire seul avant la parole
QUEUE = 4.0
FPS = 30
HAUT = "H*0.30"  # le verset est seul à l'écran : il peut vivre plus bas


def cle_eleven() -> str:
    if os.environ.get("ELEVENLABS_API_KEY", "").startswith("sk_"):
        return os.environ["ELEVENLABS_API_KEY"]
    ps = subprocess.run(["ps", "axeww"], capture_output=True, text=True).stdout
    for ligne in ps.splitlines():
        if "elevenlabs-mcp" in ligne:
            m = re.search(r"ELEVENLABS_API_KEY=(sk_\S+)", ligne)
            if m:
                return m.group(1)
    sys.exit("Clé ElevenLabs introuvable : le connecteur MCP est-il actif ?")


def duree(f: pathlib.Path) -> float:
    return float(subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "csv=p=0", str(f)], capture_output=True, text=True, check=True).stdout)


def etape_voix(unites: dict, sortie: pathlib.Path) -> None:
    cle = cle_eleven()
    for u, bloc in unites.items():
        dest = sortie / f"{u}.mp3"
        if dest.exists() and dest.stat().st_size > 10_000:
            print(f"{u} déjà là", flush=True)
            continue
        dest.parent.mkdir(parents=True, exist_ok=True)
        req = urllib.request.Request(
            f"https://api.elevenlabs.io/v1/text-to-speech/{VOIX[u]}"
            "?output_format=mp3_44100_128",
            data=json.dumps({
                "text": bloc["narration"],
                "model_id": "eleven_v3",
                "language_code": "fr",
                # Plus lent que les exhortations : c'est une méditation.
                "voice_settings": {"stability": 0.6, "similarity_boost": 0.75,
                                   "use_speaker_boost": True, "speed": 0.95},
            }).encode(),
            headers={"xi-api-key": cle, "Content-Type": "application/json"},
            method="POST")
        with urllib.request.urlopen(req, timeout=180) as r:
            dest.write_bytes(r.read())
        print(f"{u} voix ok ({dest.stat().st_size // 1024} Ko)", flush=True)


def etape_montage(unites: dict, voix_dir: pathlib.Path, sortie: pathlib.Path,
                  travail: pathlib.Path) -> None:
    for u, bloc in unites.items():
        dest = sortie / f"{u}.mp4"
        if dest.exists() and dest.stat().st_size > 100_000:
            print(f"{u} déjà monté", flush=True)
            continue
        voix = voix_dir / f"{u}.mp3"
        musique = MUSIQUES / f"{bloc['musique']}.mp3"
        if not voix.exists() or not musique.exists():
            print(f"{u} : source absente, ignorée", flush=True)
            continue

        pv = travail / f"verset-{u}.png"
        pc = travail / f"cloture-{u}.png"
        planches.planche_verset(bloc["verset"], bloc["verset_fr"], pv, "fr")
        planches.planche_cloture(bloc["cloture"], pc, "fr")

        dv = duree(voix)
        total = round(AMORCE + dv + QUEUE, 3)
        apparition_cloture = round(total - 5.0, 3)
        arret_verset = round(apparition_cloture - 0.6, 3)
        sortie_video = round(total - 1.0, 3)
        c0, c1, c2 = bloc["teinte"]

        # Le fond : un dégradé à trois teintes dont les foyers dérivent très
        # lentement. `speed` est volontairement minuscule — on cherche un
        # mouvement qu'on remarque à peine, pas une animation.
        fond = (f"gradients=size=1080x1920:c0={c0}:c1={c1}:c2={c2}:c3={c0}"
                f":x0=150:y0=1500:x1=950:y1=350:nb_colors=4:speed=0.006"
                f":duration={total}:rate={FPS}")

        chaine = (
            # Un grain léger empêche le dégradé de « bander » sur les écrans
            # qui affichent mal les aplats.
            f"[0:v]noise=alls=6:allf=t+u,format=yuv420p[fondgrain];"
            f"[1:v]scale=1080:1920[voile];[fondgrain][voile]overlay=0:0[v1];"
            f"[2:v]format=rgba,fade=in:st=1.4:d=1.6:alpha=1,"
            f"fade=out:st={arret_verset}:d=1.0:alpha=1[verset];"
            f"[v1][verset]overlay=(W-w)/2:{HAUT}[v2];"
            f"[3:v]format=rgba,fade=in:st={apparition_cloture}:d=1.2:alpha=1[clot];"
            f"[v2][clot]overlay=(W-w)/2:{HAUT}[v3];"
            f"[v3]fade=in:st=0:d=1.2,fade=out:st={sortie_video}:d=1.0,"
            f"trim=0:{total},setpts=PTS-STARTPTS[v];"
        )
        ms = int(AMORCE * 1000)
        reprise = round(AMORCE + dv + 0.3, 3)
        chaine += (
            f"[5:a]adelay={ms}|{ms},volume=1.0,asplit=2[vo][pilote0];"
            f"[pilote0]apad=whole_dur={total}[pilote];"
            f"[4:a]volume=0.55[mus0];"
            f"[mus0][pilote]sidechaincompress=threshold=0.20:ratio=2.5:attack=20"
            f":release=600:makeup=1[mus1];"
            f"[mus1]volume='if(lt(t,{AMORCE}),1.35,if(lt(t,{reprise}),1.0,1.8))'"
            f":eval=frame[mus2];"
            f"[mus2][vo]amix=inputs=2:duration=first:weights='1 1':normalize=0,"
            f"atrim=0:{total},asetpts=PTS-STARTPTS,alimiter=limit=0.94,"
            f"afade=in:st=0:d=1.5,afade=out:st={round(total - 2.0, 3)}:d=2.0[a]"
        )

        dest.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run(
            ["ffmpeg", "-v", "error", "-y",
             "-f", "lavfi", "-i", fond,
             "-loop", "1", "-i", str(voile(travail)),
             "-loop", "1", "-i", str(pv),
             "-loop", "1", "-i", str(pc),
             "-stream_loop", "-1", "-i", str(musique),
             "-i", str(voix),
             "-filter_complex", chaine,
             "-map", "[v]", "-map", "[a]", "-t", str(total),
             "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p",
             "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", str(dest)],
            check=True)
        print(f"{u} {duree(dest):.1f}s {dest.stat().st_size // 1024} Ko", flush=True)


def voile(dossier: pathlib.Path) -> pathlib.Path:
    """Assombrit haut et bas pour que le texte tienne sur le dégradé."""
    p = dossier / "voile.png"
    if p.exists():
        return p
    dossier.mkdir(parents=True, exist_ok=True)
    haut, bas = dossier / ".h.png", dossier / ".b.png"
    subprocess.run(["magick", "-size", "1080x900",
                    "gradient:rgba(2,6,23,0.55)-rgba(2,6,23,0.10)", str(haut)], check=True)
    subprocess.run(["magick", "-size", "1080x1020",
                    "gradient:rgba(2,6,23,0.10)-rgba(2,6,23,0.72)", str(bas)], check=True)
    subprocess.run(["magick", str(haut), str(bas), "-append", str(p)], check=True)
    haut.unlink(missing_ok=True)
    bas.unlink(missing_ok=True)
    return p


def main() -> None:
    etape = sys.argv[1] if len(sys.argv) > 1 else ""
    base = pathlib.Path(sys.argv[2]) if len(sys.argv) > 2 else ICI / "sortie"
    unites = {k: v for k, v in json.load(open(ICI / "versets.json")).items()
              if not k.startswith("_")}
    if etape == "voix":
        etape_voix(unites, base / "voix")
    elif etape == "montage":
        etape_montage(unites, base / "voix", base / "videos", base / "planches")
    else:
        sys.exit("usage : produire.py voix|montage [dossier]")


if __name__ == "__main__":
    main()
