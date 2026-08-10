# Doublage des vidéos d'amorçage — 10 langues

Chaque vidéo publiée existe en dix versions parlées : anglais, espagnol,
portugais, italien, allemand, russe, arabe, chinois, japonais, coréen. Le
fil sert la version correspondant à la langue du lecteur ; les langues sans
doublage (français d'origine, hébreu) reçoivent la version française, avec
verset et légende traduits.

## Chaîne

| Étape | Script | Sortie |
|---|---|---|
| 1. Narrations | `lang/<lang>.json` | 12 textes parlés + clôtures par langue |
| 2. Voix | `generer-voix.py <dossier>` | `<lang>/<unite>.mp3` |
| 3. Montage | `monter.py --voix … --sortie … --travail …` | `<lang>/<unite>.mp4` |
| 4. Publication | `publier.py --videos … --mot-de-passe …` | bucket + `video_translations` |

Chaque étape est idempotente : relancer après une coupure reprend où ça
s'était arrêté, sans refaire ni repayer ce qui existe.

## Narrations

`narrations-fr.json` est extrait des scénarios d'origine. Les traductions
(`lang/*.json`) suivent trois règles :

- la narration **commence par le verset**, cité mot pour mot dans une
  traduction biblique établie de la langue (KJV, Reina-Valera, Almeida,
  Riveduta, Luther, synodale, Van Dyck, Union chinoise, 口語訳, 개역한글) —
  jamais une traduction inventée ;
- la référence est écrite **en toutes lettres**, parce qu'une voix de
  synthèse lit « 34:18 » de travers ;
- la longueur vise **20 secondes** : 60 à 68 mots en latin, 55 à 63 en
  russe, 105 à 125 signes en chinois, 130 à 155 en japonais, 115 à 140 en
  coréen.

## Texte gravé

`planches.py` compose les planches avec **Chrome headless**, pas avec
ImageMagick. Ce n'est pas un détour : cette installation d'ImageMagick n'a
ni RAQM ni Pango (`magick -version` ne liste que freetype), donc l'arabe y
sort dans l'ordre logique, lu à l'envers — constaté à l'écran. Le CJC, lui,
ne se coupait pas en fin de ligne, faute d'espaces où couper. Un navigateur
applique l'algorithme bidirectionnel, le façonnage contextuel et les règles
de césure : une seule voie de rendu pour toutes les écritures, aucune ne
devient un cas particulier qu'on oublie de retester.

## Voix

Deux voix en alternance, comme les scénarios français : Sarah
(`EXAVITQu4vr4xnSDxMaL`, féminine) et Roger (`CwhRBWXzGAHq8TQ4Fs17`,
masculine). Modèle **`eleven_v3`** — le seul à couvrir les onze écritures
(`eleven_multilingual_v2` n'a pas l'hébreu).

La clé API est fournie explicitement au processus de synthèse via
`ELEVENLABS_API_KEY`. Elle n'est jamais recherchée dans les processus déjà
lancés, écrite sur disque ni affichée. Le mot de passe des scripts de
publication est demandé de façon interactive : il ne doit jamais figurer
dans une option de commande.

## Coût

120 narrations ≈ 47 000 caractères, soit ~14 % du quota mensuel Creator
(347 544 caractères).

⚠️ L'abonnement Creator porte une annulation programmée au **2026-08-23**.
Le quota se réinitialise à cette même date : la tranche actuelle est la
dernière si l'annulation n'est pas levée.

## Hébreu

Volontairement hors doublage. L'interface, les versets et les légendes
restent traduits en hébreu ; seule la bande son reste française.
