# ADR-0002 — Modération : taxonomie, rôles, délais, sanctions et appels

## Statut

remplacé — voir [ADR-0012 — Modération protectrice](ADR-0012-moderation-protection.md).

## Contexte

Existant vérifié dans le dépôt :

- `public.reports` (`0001_selah_core.sql`) : enum `public.report_status`
  (`'ouvert'`, `'traite'`, `'rejete'`) et une cible unique, post, commentaire
  ou vidéo.
- `0011_reports_and_counter_integrity.sql` : motif de 3 à 500 caractères,
  index de file `(status, created_at desc)`, unicité par signalant et cible.
- `0014_moderation_audit.sql` : le signalement survit à la suppression du
  contenu (clés étrangères `on delete set null`) et la table
  `public.moderation_events` journalise `report_created`,
  `report_status_changed` et `video_hidden_changed`, en lecture réservée aux
  rôles `'moderateur'` et `'admin'`.
- L'enum `public.user_role` : `membre`, `leader`, `pasteur`, `moderateur`,
  `admin`.
- Les Server Actions `setVideoHidden` et `resolveReport`
  (`src/app/actions.ts`), avec garde de rôle, appelées depuis
  `src/app/(app)/moderation/boutons.tsx`.

Le motif est une chaîne libre et les deux insertions écrivent la même
constante : `reason: "signalement utilisateur"` (`src/app/actions.ts`, lignes
363 et 522). Aucun tri ni aucune statistique par motif n'est possible.

Manquent : taxonomie, délais cibles, sanctions graduées, procédure d'appel,
blocage et sourdine entre membres. `docs/OPERATIONS_RUNBOOK.md` chiffre
désormais un seuil de 24 h sans décision sur un signalement, mais aucun
responsable n'y est nommé et aucune alerte n'est automatique. Le volume de
signalements n'est pas mesuré ; aucun effectif n'est décidé.

## Décision

Acquis, décidé par l'équipe technique et déjà écrit dans les migrations : les
rôles portés par `user_role`, la garde de rôle côté serveur, le journal
`moderation_events`, la conservation des signalements.

Non décidé, exigeant une décision non technique avant toute écriture de code :

1. Taxonomie de motifs, fermée et stockée dans une colonne dédiée.
2. Délais cibles de première prise en charge, par gravité.
3. Barème de sanctions graduées, du masquage à la suspension de compte.
4. Procédure d'appel : canal, délai de réponse, autorité de réexamen.
5. Blocage et mise en sourdine entre membres.

Aucune de ces cinq briques n'est implémentée tant que le décideur n'est pas
nommé et que le barème n'est pas écrit.

## Conséquences

- La file ne peut être triée que par ancienneté. Un contenu grave et une
  remarque mineure y ont le même rang.
- Le journal permet une reconstitution a posteriori, mais ne mesure aucun
  délai cible puisqu'aucun n'est fixé.
- La seule sanction disponible est le masquage d'une vidéo. Aucune sanction de
  compte n'existe dans le schéma.
- Un membre dont le contenu est masqué n'a aucun recours documenté.
- Chaque semaine de report ajoute des lignes à reclasser : la migration future
  devra rétro-remplir les motifs sur une valeur `non_classe`.

## Réversibilité

- Taxonomie : migration additive (table de motifs plus colonne de catégorie),
  les lignes existantes basculant sur `non_classe`. Réversible par suppression
  de la colonne, sans perte des motifs libres déjà écrits.
- Sanctions de compte, blocage et sourdine : tables séparées, réversibles par
  suppression de ligne ou de table.
- `moderation_events` est traité comme un journal d'ajout seul : aucune
  fonctionnalité ne doit reposer sur son effacement.

## Preuves exigées avant ouverture

1. Le responsable de la modération et son suppléant : à nommer.
2. La taxonomie écrite, chaque motif avec sa définition et son action.
3. Les délais cibles chiffrés par gravité, avec les heures de permanence.
4. Le barème de sanctions, et l'autorité qui prononce chaque niveau.
5. La procédure d'appel écrite, avec son délai de réponse.
6. Un test automatisé prouvant qu'un compte hors `'moderateur'` et `'admin'`
   ne peut ni masquer une vidéo ni changer le statut d'un signalement, y
   compris par appel direct à PostgREST et pas seulement par la Server Action.
7. Une requête sur `moderation_events` montrant la ligne écrite lors d'un
   masquage réel, avec ses états avant et après.
8. Le volume de signalements observé sur 30 jours : non mesuré à ce jour.
