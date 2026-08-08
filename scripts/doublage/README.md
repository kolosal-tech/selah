# Doublage des vidéos d'amorçage — 11 langues

Objectif : pour chacune des 12 vidéos publiées (compte `selah_lumiere`),
produire une variante par langue — narration doublée, verset et clôture
gravés dans la langue — puis la publier dans le bucket et renseigner
`video_translations.storage_path` / `thumb_path`. Le fil sert déjà la
variante quand ces colonnes sont remplies (repli : vidéo française).

## Chaîne

1. **Narrations** : `narrations.json` — pour chaque unité (01–12) et chaque
   langue, le texte à dire (60–68 mots, calibré ~20 s) et la clôture gravée.
   Les versets et références par langue viennent de
   `../traductions-videos.json` (traductions bibliques établies).
2. **Voix** : `doubler.py --etape voix` appelle ElevenLabs
   (`eleven_multilingual_v2`, voix femme/homme selon l'unité, comme la
   version française). Sortie : `voix/<lang>/<unite>.mp3`.
3. **Montage** : `doubler.py --etape montage` re-rend chaque vidéo avec le
   même moteur que `remonter-textes.sh` (mêmes images, mêmes mouvements,
   même mixage sidechain), texte gravé dans la langue. RTL : l'arabe et
   l'hébreu passent par Pango (`magick pango:`) pour un façonnage correct.
4. **Publication** : `doubler.py --etape publier` dépose
   `<uid>/<uuid>-<lang>.mp4/.jpg` dans le bucket `videos` (session
   `selah_lumiere`) et met à jour `video_translations`.

## Préalables

- `ELEVENLABS_API_KEY` **valide** (commence par `sk_`) dans
  `~/.claude/.env.mcp`. La valeur actuelle est un identifiant de clé,
  refusé par l'API (`api_key_id_used_as_api_key`).
- Les images sources des unités (dossier `seed/images` de la session de
  montage) et la nappe `public/sons/ambiance-selah.m4a`.

## Coût estimé

12 unités × 11 langues × ~65 mots ≈ 8 600 mots ≈ 52 000 caractères de TTS.
Sur ElevenLabs : ~52 000 crédits (plan Creator ou supérieur conseillé).

## Reprise

Chaque étape est idempotente : un fichier déjà produit n'est pas régénéré ;
une ligne `video_translations` déjà pourvue de `storage_path` est sautée.
