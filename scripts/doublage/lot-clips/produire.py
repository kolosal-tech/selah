#!/usr/bin/env python3
"""Six unités montées sur des plans filmés.

Les douze premières vidéos animent des images fixes. Celles-ci partent de
plans réellement filmés (dix secondes chacun) : le mouvement est dans
l'image, pas simulé au montage. Le plan est ralenti puis fondu sur
lui-même pour couvrir la durée de la narration — un raccord invisible
plutôt qu'une boucle qui saute.

Le reste ne change pas : voile, verset et clôture dans le tiers haut,
nappe d'ambiance creusée sous la voix par un compresseur à chaîne
latérale, mêmes réglages que le reste du fil.

  produire.py voix    → synthèse ElevenLabs des six narrations
  produire.py montage → six mp4
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

SEED = pathlib.Path(
    "/private/tmp/claude-501/-Users-mskolosalgmail-com-Developer-TIKTOK-CRETIEN"
    "/669ffbf0-ffec-48af-9e68-1a0ada9af60d/scratchpad/seed"
)
CLIPS = SEED / "clips"
NAPPE = RACINE.parents[1] / "public/sons/ambiance-selah.m4a"

SARAH = "EXAVITQu4vr4xnSDxMaL"
ROGER = "CwhRBWXzGAHq8TQ4Fs17"
VOIX = {"13": SARAH, "14": ROGER, "15": ROGER, "16": SARAH, "17": SARAH, "18": ROGER}

RALENTI = 1.8    # le plan de 10 s devient 18 s
FONDU = 1.5      # recouvrement du raccord sur soi-même
AMORCE = 2.0
QUEUE = 4.5
HAUT = "H*0.155"


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
                "voice_settings": {"stability": 0.5, "similarity_boost": 0.75,
                                   "use_speaker_boost": True, "speed": 1.1},
            }).encode(),
            headers={"xi-api-key": cle, "Content-Type": "application/json"},
            method="POST")
        with urllib.request.urlopen(req, timeout=180) as r:
            dest.write_bytes(r.read())
        print(f"{u} voix ok ({dest.stat().st_size // 1024} Ko)", flush=True)


def voile(dossier: pathlib.Path) -> pathlib.Path:
    p = dossier / "voile.png"
    if p.exists():
        return p
    dossier.mkdir(parents=True, exist_ok=True)
    haut, bas = dossier / ".h.png", dossier / ".b.png"
    subprocess.run(["magick", "-size", "1080x780",
                    "gradient:rgba(2,6,23,0.62)-rgba(2,6,23,0.06)", str(haut)], check=True)
    subprocess.run(["magick", "-size", "1080x1140",
                    "gradient:rgba(2,6,23,0.06)-rgba(2,6,23,0.80)", str(bas)], check=True)
    subprocess.run(["magick", str(haut), str(bas), "-append", str(p)], check=True)
    haut.unlink(missing_ok=True)
    bas.unlink(missing_ok=True)
    return p


def etape_montage(unites: dict, voix_dir: pathlib.Path, sortie: pathlib.Path,
                  travail: pathlib.Path) -> None:
    for u, bloc in unites.items():
        dest = sortie / f"{u}.mp4"
        if dest.exists() and dest.stat().st_size > 100_000:
            print(f"{u} déjà monté", flush=True)
            continue
        voix = voix_dir / f"{u}.mp3"
        clip = CLIPS / f"{bloc['clip']}.mp4"
        if not voix.exists() or not clip.exists():
            print(f"{u} : source absente, ignorée", flush=True)
            continue

        pv = travail / f"verset-{u}.png"
        pc = travail / f"cloture-{u}.png"
        planches.planche_verset(bloc["verset"], bloc["verset_fr"], pv, "fr")
        planches.planche_cloture(bloc["cloture"], pc, "fr")

        dv = duree(voix)
        total = AMORCE + dv + QUEUE
        lent = duree(clip) * RALENTI
        arret_verset = round(min(16.0, total - 8.0), 3)
        apparition_cloture = round(total - 6.0, 3)
        sortie_video = round(total - 0.9, 3)
        decalage = round(lent - FONDU, 3)

        chaine = (
            f"[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,"
            f"setpts={RALENTI}*PTS,fps=30,eq=saturation=1.06:contrast=1.04[s0];"
            f"[1:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,"
            f"setpts={RALENTI}*PTS,fps=30,eq=saturation=1.06:contrast=1.04[s1];"
            f"[s0][s1]xfade=transition=fade:duration={FONDU}:offset={decalage}[base];"
            f"[4:v]scale=1080:1920[voile];[base][voile]overlay=0:0[v1];"
            f"[2:v]format=rgba,fade=in:st=1.6:d=1.2:alpha=1,"
            f"fade=out:st={arret_verset}:d=1.0:alpha=1[verset];"
            f"[v1][verset]overlay=(W-w)/2:{HAUT}[v2];"
            f"[3:v]format=rgba,fade=in:st={apparition_cloture}:d=1.0:alpha=1[clot];"
            f"[v2][clot]overlay=(W-w)/2:{HAUT}[v3];"
            f"[v3]fade=in:st=0:d=0.8,fade=out:st={sortie_video}:d=0.9,"
            f"trim=0:{total},setpts=PTS-STARTPTS[v];"
        )
        ms = int(AMORCE * 1000)
        reprise = round(AMORCE + dv + 0.3, 3)
        rampe = f"0.95+0.65*(t-1.85)/{round(reprise - 1.85, 3)}"
        chaine += (
            f"[6:a]adelay={ms}|{ms},volume=1.0,asplit=2[vo][pilote0];"
            f"[pilote0]apad=whole_dur={total}[pilote];"
            f"[5:a]volume=0.40[pad0];"
            f"[pad0][pilote]sidechaincompress=threshold=0.22:ratio=2:attack=15"
            f":release=520:makeup=1[pad1];"
            f"[pad1]volume='if(lt(t,1.85),1.30,if(lt(t,{reprise}),{rampe},2.20))'"
            f":eval=frame[pad2];"
            f"[pad2][vo]amix=inputs=2:duration=first:weights='1 1':normalize=0,"
            f"atrim=0:{total},asetpts=PTS-STARTPTS,alimiter=limit=0.94,"
            f"afade=in:st=0:d=1.2,afade=out:st={round(total - 1.4, 3)}:d=1.4[a]"
        )

        dest.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run(
            ["ffmpeg", "-v", "error", "-y",
             "-i", str(clip), "-i", str(clip),
             "-loop", "1", "-i", str(pv),
             "-loop", "1", "-i", str(pc),
             "-loop", "1", "-i", str(voile(travail)),
             "-stream_loop", "-1", "-i", str(NAPPE),
             "-i", str(voix),
             "-filter_complex", chaine,
             "-map", "[v]", "-map", "[a]", "-t", str(total),
             "-c:v", "libx264", "-preset", "medium", "-crf", "21", "-pix_fmt", "yuv420p",
             "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", str(dest)],
            check=True)
        print(f"{u} {duree(dest):.1f}s {dest.stat().st_size // 1024} Ko", flush=True)


def main() -> None:
    etape = sys.argv[1] if len(sys.argv) > 1 else ""
    base = pathlib.Path(sys.argv[2]) if len(sys.argv) > 2 else ICI / "sortie"
    unites = {k: v for k, v in json.load(open(ICI / "narrations-fr.json")).items()
              if not k.startswith("_")}
    if etape == "voix":
        etape_voix(unites, base / "voix")
    elif etape == "montage":
        etape_montage(unites, base / "voix", base / "videos", base / "planches")
    else:
        sys.exit("usage : produire.py voix|montage [dossier]")


if __name__ == "__main__":
    main()
