# Fond d'ambiance — images et son

Objectif : que l'application entière ait la beauté de la vidéo de présentation
du landing page (plage à l'heure dorée, or / turquoise / corail), sans coûter
la lisibilité ni la bande passante.

## Ce qui a été produit

### Images — Higgsfield, `nano_banana_2`, 16:9, 2k

Six photographies cinématiques, une par univers de l'application, générées à
partir de la direction artistique lue dans `public/landing/hero-large.mp4`.

| Fichier | Sujet | Routes |
|---|---|---|
| `aube` | océan tropical à l'heure dorée, rayons | `/feed`, `/challenges`, `/mentorship`, `/videos` |
| `priere` | ciel d'aube, halo doré dans les nuages | `/prayer` |
| `chambre-haute` | bokeh doré au-dessus d'un océan de nuit | `/rooms`, `/moderation` |
| `monde` | Terre vue de l'orbite, ligne d'aube | `/map`, `/pastor` |
| `sabbat` | océan sous la lune, chemin d'argent | `/sabbath`, `/hors-ligne` |
| `assemblee` | plage au couchant, palmiers | `/churches`, `/login`, `/signup` |

Deux routes n'ont **pas** de fond photo : `/` (feed vidéo plein écran) et
`/decouvrir` (vidéo hero). Une image y serait invisible et payée pour rien.

Encodage : `cwebp -q 70` en 1920 px et `-q 60` en 1080 px, servis par `srcSet`.
Total des douze fichiers : **604 Ko** — le plus lourd fait 127 Ko.

### Son — synthèse locale, pas Higgsfield

`public/sons/ambiance-selah.m4a` — nappe instrumentale de 32 s en Ré majeur
add9, bouclable sans raccord audible (chaque partiel et chaque LFO fait un
nombre entier de cycles sur la boucle : écart de 4/32767 entre le dernier
échantillon et le premier). AAC 64 kbit/s, 258 Ko.

**Le MCP Higgsfield ne génère pas de musique** : `generate_audio` est un outil
de synthèse vocale et refuse explicitement les demandes de musique ou de
bruitage, et `apps_search` ne renvoie aucune application de musique. La nappe a
donc été synthétisée localement, ce qui a l'avantage d'être libre de droits et
reproductible :

```bash
python3 scripts/synthese-pad.py /tmp/pad.wav && ffmpeg -y -i /tmp/pad.wav -c:a aac -b:a 64k -movflags +faststart public/sons/ambiance-selah.m4a
```

## Décisions

**Luminance abaissée sur l'image, pas par empilement de voiles.**
`filter: brightness(0.72)` sur la photographie plus un dégradé sombre léger.
Empiler des voiles opaques pour atteindre le même contraste virait au gris et
tuait les couleurs qui font l'intérêt de l'image.

**Ombre portée sur tout le texte** (`main`, `header`). Une photographie a des
zones claires imprévisibles — reflet de lune, disque solaire. L'ombre rend la
lisibilité indépendante de ce qui se trouve derrière. Deux exceptions : les
surfaces opaques (boutons dégradés, pastilles, champs) et les titres en dégradé
— sur ces derniers le glyphe est transparent, l'ombre se verrait *à travers*.

**Champs de saisie assombris** (`rgba(2,6,23,0.45)` au lieu d'un blanc
translucide) : au-dessus d'un ciel de couchant, un voile blanc laissait
l'invite et le texte saisi illisibles.

**Mode Lite.** `navigator.connection.saveData` ou un lien `2g`/`slow-2g` :
aucune image n'est chargée, le dégradé du layout suffit. La décision est prise
côté client via `useSyncExternalStore` (le rendu serveur ne charge jamais
l'image), et rejouée si le réseau change.

**Dérive lente** (Ken Burns, 64 s) désactivée sous `prefers-reduced-motion`.

**Son jamais automatique.** `preload="none"` : les 258 Ko ne partent sur le
réseau que si l'utilisateur active le bouton. Le choix est mémorisé, la lecture
se suspend quand l'onglet passe en arrière-plan, et un refus du navigateur
remet le bouton dans l'état réel au lieu de mentir.

## Corrections faites au passage

- `/sabbath`, `/hors-ligne`, `/rooms/[id]` étaient rédigés en thème clair
  (`text-stone-900`, `bg-white`) sur un fond sombre : texte quasi invisible.
  Passés à la DA sombre.
- Le service worker n'est plus enregistré en développement : les fragments de
  `next dev` ne portent pas d'empreinte de contenu, donc la stratégie « cache
  d'abord » resservait indéfiniment l'ancien CSS après modification. Tester le
  hors-ligne avec `pnpm build && pnpm start`.
- Cache du service worker passé à `selah-v2` (les anciens caches sont purgés à
  l'activation) et les préfixes `/fonds/`, `/sons/`, `/landing/` y sont
  désormais mis en cache : c'est exactement ce qu'on veut garder en 2G.
- Le landing page a maintenant un `poster` : la première image peinte est déjà
  celle de la DA, même avant le premier octet des 2,7 Mo de vidéo.

## Vérifié

- `pnpm exec tsc --noEmit` — sans erreur.
- `pnpm lint` — 0 erreur (3 avertissements préexistants sur `k6/`).
- `pnpm test` — 25 tests, 3 fichiers, tous verts.
- `pnpm build` — compilation réussie, 20 pages générées.
- Rendu réel en navigateur sur `/login`, `/signup`, `/decouvrir`, `/hors-ligne`
  et `/` (bureau et mobile 375×812).

**Non vérifié visuellement** : les pages derrière authentification (`/feed`,
`/prayer`, `/rooms`, `/map`, `/challenges`…). Elles partagent le même composant
de fond et la même feuille de style que les pages testées, et la compilation
passe, mais le rendu connecté reste à regarder.
