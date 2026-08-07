# Validation — Selah phase 2 (2026-08-07)

Production : https://selah-wheat.vercel.app
Backend : Supabase `selah` (`ilqzmpcmahxxnbdrugyt`, eu-west-3)
Migrations ajoutées : `0004_selah_phase2`, `0005_selah_bucket_videos`

## Tests unitaires
```
pnpm test → 25 tests, 3 fichiers, tous verts (sabbath, streak, challenge)
```

## Parcours E2E réel, sur la production
| Fonction | Vérification | Résultat |
|---|---|---|
| Vidéos | Upload dans Storage + ligne `videos` avec le JWT du compte QA | 200 / 201, vidéo servie en `video/mp4` (4 111 octets) |
| Vidéos | Affichage dans le fil vidéo | lecteur présent, capture d'écran |
| Upper Room | Création d'une salle depuis l'UI | salle créée, redirection, « 1 personne présente » |
| Upper Room | Message poussé par l'API pendant que la page est ouverte | apparu **sans rechargement**, indicateur « ● en direct » |
| Défis | Création puis pointage du jour depuis l'UI | « Jour 1 / 21 », avancement 1/21 (5 %), bouton verrouillé ensuite |
| Dashboard pasteur | Rattachement à une église puis lecture des agrégats | 1 membre, 1 jour de fidélité, 1 publication, 1 prière |
| PWA | `/manifest.json`, `/sw.js`, `/icon-192.png`, `/icon-512.png`, `/hors-ligne` | tous 200 avec le bon type MIME |

## Sécurité — tests adverses passés
| Attaque tentée | Résultat |
|---|---|
| Déposer un fichier dans le dossier Storage d'un autre membre | HTTP 400 refusé |
| Publier une vidéo au nom d'un autre `author_id` | `42501 new row violates row-level security policy` |
| Lire les messages de salle avec la seule clé anon | `[]` (aucune ligne) |

Advisor Supabase après migrations : aucune alerte `rls_disabled`. Reste
`touch_streak()` exécutable par `authenticated` — intentionnel, la fonction est
bornée à `auth.uid()`.

## Trois bugs trouvés en validation, corrigés
1. **Fond noir, texte illisible en thème sombre.** Le `globals.css` de
   create-next-app posait `body { background: var(--background) }` hors couche
   CSS ; cette règle l'emportait sur les utilitaires Tailwind et basculait le
   fond en `#0a0a0a`. Palette déclarée explicitement claire.
2. **Upper Room muet.** Le socket Realtime partait sans le jeton de
   l'utilisateur : la RLS l'évalue comme anonyme et ne lui livre aucun
   événement, sans erreur. Ajout de `realtime.setAuth()` avant l'abonnement,
   plus un repli par interrogation toutes les 4 s (réseaux qui coupent les
   WebSockets) avec l'état du lien affiché.
3. **Service worker inatteignable.** Le proxy redirigeait `/sw.js` et
   `/hors-ligne` vers `/login` (HTTP 307) : le mode hors ligne ne pouvait pas
   s'installer. Les deux chemins sont passés en publics.

## Charge
k6 smoke sur la production : 315 requêtes, **0 % d'échec**, p95 **252 ms**.

## Reste ouvert
- **Semailles / crowdfunding** : bloqué sur une décision qui n'est pas technique
  (entité légale + compte Stripe Connect). Rien n'a été codé côté paiement.
- **Audio dans Upper Room** : le texte et la présence sont livrés ; l'audio
  temps réel demande un service tiers (LiveKit ou équivalent), donc un coût.
- **Traduction IA** : la route `/api/translate` existe et renvoie un 501 propre
  tant que `TRANSLATE_API_URL` / `TRANSLATE_API_KEY` ne sont pas fournis.
- **Notifications push** : non livrées.
- **Applications natives** (Expo/stores) : non livrées.
- **Protection contre les mots de passe compromis** (HaveIBeenPwned) :
  désactivée sur le projet Supabase, à activer dans le tableau de bord
  (Authentication → Passwords) — un seul interrupteur, aucune migration.
