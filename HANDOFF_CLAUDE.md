# Relais Claude Code — Selah

Lis d’abord `AGENTS.md`, puis `state.md` et ce document. La racine Git est ce
dossier `selah/`; le répertoire parent n’est pas un dépôt. Commence par
`git status --short` : le worktree peut contenir des modifications légitimes à
préserver. Ne lance ni reset, clean, stash ni réécriture globale.

## Nouveau mandat d'évolution

Après les trois lectures ci-dessus, lis intégralement
`OBJECTIF_CLAUDE_EVOLUTION.md`. Il contient le plan produit, sécurité,
robustesse, monétisation, marketing et commercial ainsi que l'objectif autonome
à exécuter. Ses prix et KPI sont des hypothèses à tester, pas des décisions de
production. Il n'autorise ni dépense, ni paiement réel, ni nouveau fournisseur,
ni migration/déploiement de production sans validation explicite dans la
conversation Claude courante.

## Livraison du 11 août 2026

- Média : capture vidéo mobile native, caméra+micro, audio seul, sélection de
  fichiers, dépôt unitaire/par lot et lecture audio dans le fil. Le correctif
  Storage conserve l’`upsert` idempotent et ajoute une policy SELECT limitée au
  dossier UID dans `supabase/migrations/20260810221136_media_profile_room_audio.sql`.
- Auth : œil afficher/masquer, erreur de connexion stable sans message Supabase
  brut, CTA contextuel et parcours PKCE de réinitialisation.
- Upper Rooms : entrée audio volontaire, micro coupé par défaut, maillage WebRTC
  P2P limité à quatre, signaux privés et « couper tous » réservé à
  l’hôte/modérateur/admin par RLS/RPC.
- Profil : recadrage, zoom/repositionnement, remplacement avec nettoyage de
  l’ancien avatar, suppression et paramètres son/ambiance/animations/langue.

## Preuves locales

```bash
NEXT_TELEMETRY_DISABLED=1 pnpm exec next typegen # succès
pnpm lint                                        # exit 0
pnpm exec tsc --noEmit --incremental false       # exit 0
pnpm test                                        # 19 fichiers, 137 tests
pnpm test:rls                                    # RLS baseline: OK
pnpm test:schema                                 # Schema reconstruction: OK
NEXT_TELEMETRY_DISABLED=1 pnpm build              # 24 pages, exit 0
node tests/e2e/run-qa.mjs                         # desktop + Pixel 7
git diff --check                                 # sortie vide
```

Playwright couvre aussi l’œil du mot de passe, le reset, l’absence de
débordement, les contrôles d’en-tête, le clavier du fil, la capture caméra/micro
simulée, l’audio seul, les réglages, l’entrée room avant micro et les erreurs
navigateur/HTTP. Les scénarios mutants sont verrouillés par variables explicites
et nettoient les lignes et objets Storage créés.

## État distant et reprise

Les migrations `0018`, `20260810221136_media_profile_room_audio.sql` et
`20260810231500_security_performance_advisors.sql` sont appliquées au projet
Supabase. Les contrôles distants confirment RLS, suppression propriétaire vidéo
et Storage, zéro alerte Security Advisor et zéro avertissement Performance
Advisor. Supabase Auth impose huit caractères et la vérification des mots de
passe compromis. `APP_URL` et les deux variables publiques Supabase existent en
production Vercel ; l’URL canonique est couverte par la liste de redirection
`https://selah-wheat.vercel.app/**`.

À chaque reprise, compare `git rev-parse HEAD` aux métadonnées du déploiement
`READY`, puis lis `state.md` pour les preuves du dernier tir. Rejoue la suite
ci-dessus et, sur HTTPS, `E2E_BASE_URL=<url> node tests/e2e/run-qa.mjs`. La
publication vidéo/audio exige `E2E_ALLOW_MUTATING_PUBLISH=1` ; le reset réel
exige `E2E_ALLOW_RESET_EMAIL=1`. Le test de charge distant reste interdit tant
que `load-test/config.json` ne porte pas une validation humaine des seuils.

## Limites connues

Le pilote audio n’a ni TURN ni SFU : certains NAT bloqueront la liaison et un
client hostile peut ignorer un mute P2P. Un fournisseur SFU/TURN est requis
avant montée en charge audio ou modération autoritaire. Les périphériques
Playwright sont simulés : valider caméra/micro et un appel à deux appareils
physiques avant un lancement large. L’acceptation d’un reset par Supabase ne
prouve pas à elle seule la livraison SMTP.
