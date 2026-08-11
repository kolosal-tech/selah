# ADR-0003 — Rétention des données et effacement

## Statut

Proposé. 11 août 2026. Décideur : à nommer. Les durées de conservation et
l'effacement des comptes relèvent du produit et du juridique. Seul le point
sur `profiles.lang` / `profiles.locale` relève de l'équipe technique.

## Contexte

Le dépôt compte 31 migrations SQL versionnées. La dernière,
`supabase/migrations/20260811120000_product_analytics.sql`, crée
`public.product_events` (RLS deny-all, `revoke all`), la RPC
`public.record_product_event`, la vue `public.product_events_daily` réservée
aux rôles `moderateur` et `admin`, et `private.purge_product_events`. Cette
purge est livrée mais n'est pas planifiée : aucune exécution automatique.

Le pipeline média publie directement, sans état `quarantined` ni `processing`.
Les écarts entre base et Storage sont détectés par les vues décrites dans
`docs/MEDIA_RECONCILIATION.md`, qui ne suppriment rien.

Les journaux se limitent aux Vercel Runtime Logs. Il n'y a aucune télémétrie
d'erreur, aucun RUM. La durée de conservation appliquée par l'hébergeur n'a
pas été vérifiée : non mesurée.

L'export de compte et la suppression différée ne sont pas implémentés.

`profiles.lang` est modifiable par l'utilisateur ; `profiles.locale` est figée
à l'inscription, hors du grant d'écriture. Les deux colonnes portent le même
concept, ce qui rend l'effacement et l'export ambigus.

Le PITR Supabase est disponible ; aucune restauration n'a jamais été exercée.
`docs/OPERATIONS_RUNBOOK.md` chiffre les seuils depuis le 11 août 2026, mais
sa colonne « responsable » vaut « à nommer » sur chaque ligne.

## Décision

Politique proposée, par catégorie de données.

- `public.product_events` : conservation 400 jours à compter de la date de
  l'événement. La fonction `private.purge_product_events` est le seul moyen
  d'effacement retenu. Son mécanisme de planification n'est pas décidé.
- Objets Storage orphelins : purge manuelle uniquement, sur la base des vues
  de `docs/MEDIA_RECONCILIATION.md`, en excluant les objets de moins de
  24 heures. Aucune purge automatique n'est introduite par cet ADR.
- Journaux : rétention laissée à l'hébergeur, aucune copie hors plateforme.
  Durée effective non mesurée.
- Comptes supprimés : suppression différée avec fenêtre de rétractation, et
  export préalable des données. Les deux sont non implémentés et la durée de
  la fenêtre est non décidée.
- `profiles.lang` devient la colonne vivante, seule source de la langue
  courante. `profiles.locale` reste une trace figée de la langue
  d'inscription, sans grant d'écriture. La suppression de `locale` n'est pas
  retenue tant qu'aucune preuve ne montre qu'aucune lecture n'en dépend.

## Conséquences

Sans planification, la rétention à 400 jours reste déclarative :
`product_events` croît indéfiniment. L'écart entre la politique écrite et
l'état réel doit être signalé tant que la planification n'est pas décidée.

La purge manuelle des orphelins dépend d'une exécution humaine et d'un rôle
`moderateur` ou `admin`. Aucun responsable n'est nommé dans le runbook. Sans
export ni suppression différée, une demande d'effacement se traite hors
produit, sans traçabilité outillée.

Séparer `lang` et `locale` impose de documenter les deux colonnes dans tout
export de compte, et d'inclure `locale` dans l'effacement d'un compte.

## Réversibilité

Élevée. Aucune donnée n'est détruite par cet ADR : il fixe des durées et
désigne des mécanismes existants. La durée de 400 jours peut être révisée
avant la première exécution de la purge. Le choix `lang` / `locale` reste
réversible tant qu'aucune migration ne supprime de colonne. Une suppression
de colonne, elle, serait irréversible sans PITR, procédure jamais exercée.

## Preuves exigées avant ouverture

- `count(*)` sur `public.product_events` et âge du plus ancien événement.
- Exécution de `private.purge_product_events` sur un jeu de test, avec le
  nombre de lignes supprimées retourné, avant toute planification.
- Décision écrite du mécanisme de planification, avec sa preuve d'exécution.
- Sortie des vues de `docs/MEDIA_RECONCILIATION.md` sur la production,
  montrant le nombre d'orphelins de plus de 24 heures.
- Durée de rétention réelle des Vercel Runtime Logs, relevée sur le plan
  effectif du projet.
- Recherche exhaustive des lectures de `profiles.locale` dans `src/`, commande
  et sortie incluses, avant tout arbitrage de suppression.
- Responsable de la purge et des demandes d'effacement, inscrit dans
  `docs/OPERATIONS_RUNBOOK.md` à la place d'un « à nommer ».
- Un exercice de restauration PITR documenté, avant de dépendre du PITR pour
  annuler un effacement.
