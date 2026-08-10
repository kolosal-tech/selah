# État d’implémentation après audit

Ce tableau complète l’audit initial. « Validé localement » signifie que le code
et les migrations sont exercés dans ce dépôt. Les migrations distantes jusqu’à
`0018`, puis les migrations audio et advisors du 11 août 2026, sont consignées
dans `state.md` ; les décisions d’ouverture fonctionnelle restent distinctes.

| Référence | État | Preuve locale / reste à faire |
|---|---|---|
| F-001 rôle | Validé localement | Migration `0009`, test RLS : mise à jour du rôle refusée |
| F-002 prières anonymes | Validé localement | Vue `prayer_requests_public`, test RLS sans `author_id` |
| F-003 vidéos masquées | Validé localement | Bucket privé, URLs signées, RLS table/Storage testées |
| F-004 INSERT vidéo | Validé localement | Privilèges par colonne ; `hidden` et compteurs refusés |
| F-005 pipeline média | Réactivé sous contrôles | Dépôt vidéo réouvert avec quotas, chemins propriétaires, URLs signées et modération ; quarantaine, antivirus et transcodage restent requis |
| F-006 traduction | Validé localement | Session, taille, locales, timeout et quota PostgreSQL partagé |
| F-007 mineurs/mentorat | Réactivé sous contrôles | Offres et relations réouvertes sous RLS et limite par compte ; âge, vérification, supervision et procédure de signalement restent requis |
| F-008 modération | Partiel | Contraintes, conservation des cibles supprimées et journal append-only ; dossiers, sanctions et appels restent à concevoir |
| F-009 salles | Validé localement | Salle fermée et quota temps réel refusés par RLS |
| F-010 espace pasteur | Validé localement | Garde serveur de rôle ajoutée |
| F-011 i18n/schéma | Validé localement | `video_translations`, `lang` et reconstruction complète des migrations suivies |
| F-012 objets orphelins | Partiel | Retry idempotent, nettoyage après refus certain et inventaires modération ; purge planifiée requise |
| F-013 confidentialité | Décision requise | Politique, rétention, droits et sous-traitants à valider |
| F-014 secrets outils | Validé localement | Aucun scan de processus ni mot de passe CLI dans les scripts concernés |
| F-015 build/CI | Validé localement | Build sans réseau, CI et validations versionnées |
| F-016 exploitation/PRA | Décision requise | Monitoring, sauvegarde, restauration et astreinte à définir et exercer |
| F-017 anti-abus | Partiel | Limites atomiques auth/Realtime ; entrée Auth et upload direct restent à protéger |
| F-018 feed | Partiel | Pagination par curseur ; modèle de candidats et gouvernance du ranking à définir |

## Validations à rejouer

```bash
pnpm exec next typegen
pnpm lint
pnpm exec tsc --noEmit --incremental false
pnpm test
pnpm test:rls
pnpm test:schema
NEXT_TELEMETRY_DISABLED=1 pnpm build
```

Les décisions et preuves nécessaires avant tout passage sur un environnement
cible sont dans [PREPUBLICATION_GATES.md](./PREPUBLICATION_GATES.md).

## Correctif UX mobile — rail vidéo (10 août 2026)

Le rail d'actions de `src/app/vertical-feed.tsx` est compacté uniquement sous
`md` : largeur/écart réduits, icônes et compteurs ajustés, tout en conservant
des boutons de 44–48 px, les `aria-label` et les cinq actions. Les classes
`md:` préservent la présentation ordinateur. Validation : lint, TypeScript,
50 tests, reconstruction schéma, RLS, build sans réseau et déploiement
Vercel `dpl_7nAhEYYfpxxqcMJnU4dArfjqzfqi` `READY`.

La navigation secondaire expose aussi des flèches desktop précédent/suivant,
avec états désactivés aux limites, labels localisés et défilement tactile
conservé sur mobile. Le contrôle sonore du fil reste muet par défaut, rouge
lorsqu'il est coupé et blanc lorsque la lecture sonore est active. Ces
correctifs sont publiés dans Vercel
`dpl_G3RR7aM9btwbFXTd83KzfXLEPZGX` (`READY`).

Les icônes des raccourcis secondaires portent maintenant une couleur
sémantique contrastée (Intercession violet, mentorat bleu, églises vert,
pasteur indigo, modération rose, Sabbat ardoise), sans modifier les libellés,
le défilement ou les états actifs. Publication finale : Vercel
`dpl_4Dx91sJf6uN8nVdAN9S5WiBhajvr` (`READY`).

Les commentaires vidéo affichent l'auteur via un chargement explicite des
profils publics, et le compteur Amen ouvre les profils ayant réagi pour les
membres authentifiés. La photo de profil est désormais disponible après
inscription via `/profile`, avec stockage privé `avatars`, RLS propriétaire,
formats JPG/PNG/WebP et limite 5 Mo. Migration distante `0017` appliquée ;
déploiement `dpl_6RsNaMZwg68tnotBk8fYcy8GbXaY` `READY`.

Les Upper Rooms proposent désormais un pilote audio WebRTC volontaire limité à
quatre pairs : micro coupé par défaut, signalisation privée et « couper tous »
réservé à l’hôte/modérateur/admin. Sans TURN/SFU, la liaison peut échouer sur
certains NAT et le mute reste appliqué par les clients ; ne pas présenter ce
pilote comme une conférence audio à grande échelle ou une modération autoritaire.

## Correctif Fil — commentaires, Amen et publication (10 août 2026)

La page `/feed` interroge désormais les commentaires et les profils publics des
auteurs après chaque rendu. Le commentaire de @qa_timothee sous @sara est
visible en production avec son auteur et son texte après actualisation. Le
compteur « Voir qui a dit Amen » est distinct du bouton « 🙌 Amen » ; son
ouverture affiche le profil ayant réagi sans ajouter ni retirer la réaction.

La création de post redirige vers `/feed?posted=1` après insertion réussie et
affiche un état de succès ; en production le formulaire est vide après le
chargement. Le rappel autorisé demandé est présent exactement une fois ; aucun
doublon n'a été envoyé. Déploiement vérifié :
`dpl_CsP2Nbiw7d5oSyAFGhKwDS8YiPtv` (`READY`, production).
