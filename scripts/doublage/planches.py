#!/usr/bin/env python3
"""Planches de texte gravé — un moteur qui sait composer toutes les écritures.

Le montage français composait le verset avec `magick caption:`. Ça ne tient
plus dès qu'on sort du latin :

- **arabe** : ImageMagick n'a ici ni RAQM ni Pango (`magick -version` ne
  liste que freetype). Le texte sort dans l'ordre logique, sans algorithme
  bidirectionnel — donc lu à l'envers. Vérifié à l'œil, pas supposé.
- **chinois, japonais, coréen** : `caption:` ne coupe les lignes qu'aux
  espaces. Ces écritures n'en ont pas : la ligne déborde au lieu de passer
  à la suivante.

Chrome headless, lui, applique l'algorithme bidirectionnel d'Unicode, le
façonnage contextuel arabe et les règles de césure CJC — c'est exactement
son métier. On lui donne un HTML minuscule, il rend un PNG à fond
transparent. Une seule voie de rendu pour les onze langues : aucune ne
devient un cas particulier qu'on oublierait de retester.
"""
import html
import json
import pathlib
import subprocess
import tempfile

CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
LARGEUR = 820
RTL = {"ar", "he"}

# Pile de polices par langue. Le latin et le cyrillique gardent la Georgia
# italique du montage français : la version traduite doit rester la même
# vidéo, pas une autre. Les autres écritures prennent la police système qui
# les sert le mieux.
POLICES = {
    "latin": "Georgia, 'Times New Roman', serif",
    "ar": "'Geeza Pro', 'Al Bayan', sans-serif",
    "zh": "'Songti SC', 'Hiragino Sans GB', 'PingFang SC', sans-serif",
    "ja": "'Hiragino Mincho ProN', 'Hiragino Sans', sans-serif",
    "ko": "'Apple SD Gothic Neo', 'Nanum Myeongjo', sans-serif",
}


def _famille(lang: str) -> str:
    return POLICES.get(lang, POLICES["latin"])


def _italique(lang: str) -> str:
    # L'italique est une convention typographique latine. Penchée, une
    # écriture arabe ou CJC devient fautive, pas élégante.
    return "italic" if lang not in ("ar", "he", "zh", "ja", "ko") else "normal"


def corps_pour(texte: str, lang: str) -> int:
    """Corps tel que le bloc tienne dans la bande haute de l'image."""
    n = len(texte)
    if lang in ("zh", "ja", "ko"):
        return 44 if n > 34 else 50 if n > 24 else 56
    if lang == "ar":
        return 42 if n > 74 else 46 if n > 58 else 52
    if n > 74:
        return 44
    if n > 60:
        return 48
    if n > 46:
        return 53
    return 58


def _rendre(html_corps: str, sortie: pathlib.Path, hauteur_max: int = 900) -> None:
    """Rend un fragment HTML en PNG transparent, rogné à l'encre."""
    sortie.parent.mkdir(parents=True, exist_ok=True)
    page = f"""<!doctype html><meta charset="utf-8">
<style>
  html,body{{margin:0;padding:0;background:transparent}}
  body{{width:{LARGEUR}px}}
  .bloc{{width:{LARGEUR}px;text-align:center;
        text-rendering:optimizeLegibility;
        -webkit-font-smoothing:antialiased;
        text-shadow:0 2px 12px rgba(0,0,0,.55)}}
</style>
<body>{html_corps}</body>"""
    with tempfile.TemporaryDirectory() as tmp:
        f = pathlib.Path(tmp) / "p.html"
        f.write_text(page, encoding="utf-8")
        brut = pathlib.Path(tmp) / "brut.png"
        subprocess.run(
            [CHROME, "--headless", "--disable-gpu", "--hide-scrollbars",
             "--force-device-scale-factor=1",
             "--default-background-color=00000000",
             f"--window-size={LARGEUR},{hauteur_max}",
             f"--screenshot={brut}", f"file://{f}"],
            check=True, capture_output=True,
        )
        # Rogner au contenu réel, puis rendre la largeur fixe : ffmpeg pose
        # le bloc centré, il lui faut une boîte prévisible.
        subprocess.run(
            ["magick", str(brut), "-trim", "+repage",
             "-background", "none", "-gravity", "center",
             "-extent", f"{LARGEUR}x", str(sortie)],
            check=True,
        )


def planche_verset(verset: str, reference: str, sortie: pathlib.Path,
                   lang: str) -> None:
    """Verset en blanc, référence dorée en dessous, un seul PNG."""
    corps = corps_pour(verset, lang)
    dir_attr = ' dir="rtl"' if lang in RTL else ""
    corps_html = f"""
<div class="bloc"{dir_attr} lang="{lang}" style="
     font-family:{_famille(lang)};font-style:{_italique(lang)};
     font-size:{corps}px;line-height:1.34;color:#fff">{html.escape(verset)}</div>
<div style="height:22px"></div>
<div class="bloc"{dir_attr} lang="{lang}" style="
     font-family:{_famille(lang)};font-size:{max(26, corps - 20)}px;
     line-height:1.2;color:#fcd34d">{html.escape(reference)}</div>"""
    _rendre(corps_html, sortie)


def planche_cloture(texte: str, sortie: pathlib.Path, lang: str) -> None:
    corps = 48 if lang in ("zh", "ja", "ko") else 44 if lang == "ar" else 54
    dir_attr = ' dir="rtl"' if lang in RTL else ""
    corps_html = f"""
<div class="bloc"{dir_attr} lang="{lang}" style="
     font-family:{_famille(lang)};font-style:{_italique(lang)};
     font-size:{corps}px;line-height:1.32;color:#fff">{html.escape(texte)}</div>"""
    _rendre(corps_html, sortie)


def hauteur(png: pathlib.Path) -> int:
    return int(subprocess.run(["magick", "identify", "-format", "%h", str(png)],
                              capture_output=True, text=True, check=True).stdout)


if __name__ == "__main__":
    # Banc d'essai : une planche par écriture, pour vérifier à l'œil que
    # l'arabe se lit de droite à gauche et que le CJC passe à la ligne.
    trad = json.load(open(pathlib.Path(__file__).parents[1] / "traductions-videos.json"))
    bloc = trad["videos"]["Psaume 34:19"]
    e = pathlib.Path(__file__).parent / "essai"
    for lang in ["en", "ru", "ar", "zh", "ja", "ko"]:
        t = bloc[lang]
        pv = e / f"verset-{lang}.png"
        planche_verset(t["verset"], t["ref"], pv, lang)
        print(f"{lang}  {hauteur(pv)}px")
