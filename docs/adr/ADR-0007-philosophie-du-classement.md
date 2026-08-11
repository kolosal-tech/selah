# ADR-0007 — Philosophie du classement du fil

## Statut

proposé — 11 août 2026 — décideur : à nommer. Le volet produit et
juridique revient à un responsable à nommer ; la mise en œuvre revient à
l'équipe technique.

## Contexte

Le classement tient dans une seule vue SQL, `public.videos_feed`, définie
par `supabase/migrations/0008_selah_feed_social.sql`. Elle calcule deux
colonnes dérivées, jamais stockées :

- `score` : engagement pondéré `(amen*3 + pray*5 + comment*2 + 1)` divisé
  par `power(age_h + 2, 1.35)`, arrondi à six décimales. La prière pèse
  plus que l'amen.
- `rang_auteur` : `row_number()` partitionné par `author_id`, ordonné par
  score décroissant. Il intercale les auteurs au lieu d'empiler les vidéos
  d'un seul.

Le tri servi est `(rang_auteur asc, score desc, id asc)`, paginé par un
curseur composé sur ce triplet (`src/lib/feed-cursor.ts`). Le commentaire de
migration nomme la formule « feed v3 » ; ce nom n'est exposé nulle part.

Trois manques encadrent la décision. Il n'existe qu'un seul fil, sans
distinction entre comptes suivis et découverte. La qualité du classement
n'est pas mesurée : le flag `analytics` vaut `false` par défaut
(`src/lib/flags.ts`) et aucun RUM n'est installé. Enfin, le corpus porte
sur une conviction religieuse, donnée sensible.

## Décision

1. **Versionner le classement.** Toute modification de la formule, de la
   règle de diversité ou de l'ordre de tri crée une version nommée. Le nom
   est exposé à l'utilisateur dans le fil et documenté par un ADR qui
   remplace celui-ci. Le nom public de la version courante est non décidé.
2. **Séparer Abonnements et Découvrir.** Deux fils, deux requêtes, deux
   curseurs. Abonnements est restreint aux auteurs suivis et n'applique
   aucun score d'engagement. Découvrir conserve `score` et `rang_auteur`.
   L'ordre exact du fil Abonnements est non décidé.
3. **Refuser l'optimisation d'engagement au détriment du reste.** Un
   changement qui augmente une métrique d'engagement mais dégrade le
   bien-être, la diversité des auteurs ou la sécurité est rejeté, même si
   le gain est mesuré. Aucune boucle d'optimisation automatique du score.
4. **Ne jamais inférer publiquement une conviction religieuse
   individuelle.** Aucun signal dérivé du comportement d'un compte n'est
   exposé à un autre utilisateur, à un tiers ou dans un export. Les
   agrégats restent réservés aux rôles `moderateur` et `admin`, comme la
   vue `public.product_events_daily`.

## Conséquences

Deux fils imposent deux chemins de pagination et deux jeux de tests de
curseur ; l'implémentation actuelle n'en couvre qu'un. Exposer un nom de
version transforme par ailleurs le classement en engagement public : un
changement silencieux de formule devient une régression de contrat.

Le refus d'optimiser l'engagement rend la décision non falsifiable par une
métrique seule. Les arbitrages devront s'appuyer sur des critères écrits.

Le coût du classement est inconnu : `row_number()` sur partition impose un
tri complet du corpus filtré, et aucun `EXPLAIN ANALYZE` n'a été exécuté
sur un volume représentatif. Non mesuré.

L'interdiction d'inférence ferme des évolutions de recommandation : ni
profil d'affinité doctrinale, ni segment d'audience exportable.

## Réversibilité

Élevée côté données. `score` et `rang_auteur` sont calculés à la lecture,
jamais persistés : revenir à une formule antérieure tient dans une
migration `drop view` puis `create view`, sans reprise de données. Le
curseur se déduit des colonnes servies.

Deux points ne le sont pas. L'ordre déjà servi ne se rejoue pas. Un nom de
version publié reste publié : il se remplace, il ne se retire pas.

## Preuves exigées avant ouverture

- Migration exposant le nom de version, vérifiée par `pnpm test:schema`.
- Requêtes et curseurs des deux fils couverts par des tests, avec la sortie
  exacte de `pnpm test`.
- `EXPLAIN ANALYZE` de `public.videos_feed` sur un volume représentatif, le
  volume étant indiqué. Non mesuré à ce jour.
- Règle d'ordre écrite du fil Abonnements. Non décidée.
- Revue juridique écrite confirmant l'absence d'inférence publique de
  conviction religieuse, par un responsable à nommer.
- Rétention appliquée aux événements produit :
  `private.purge_product_events` existe mais n'est pas planifiée.
