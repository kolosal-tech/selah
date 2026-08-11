# ADR-0010 — Voie anonyme et métriques terrain sans clé service_role

## Statut

Accepté — 11 août 2026 — équipe technique. La voie reste fermée tant que les
preuves de la dernière rubrique ne sont pas produites : sans jeton posé dans
l'environnement de production, la RPC retourne `false` à chaque appel.

## Contexte

ADR-0008 a nommé trois événements puis les a laissés hors périmètre : l'échec
de connexion, l'échec d'inscription, l'abandon d'un visiteur anonyme. Ce n'est
pas un oubli, c'est le schéma. `public.record_product_event` porte
`revoke all ... from public, anon` puis `grant execute ... to authenticated` ;
son implémentation commence par `if actor is null then return false`. Et
`product_events.actor_id` est `not null references public.profiles(id)`. Ces
trois événements se produisent avant qu'une session existe : il n'y a pas
d'acteur à écrire dans une colonne qui en exige un.

Ouvrir la RPC existante au rôle `anon` ne résout rien — ADR-0008 l'a déjà
écarté : chaque événement deviendrait forgeable et le compteur cesserait
d'être une mesure. La colonne `actor_id` resterait de toute façon sans valeur
possible.

Second angle mort, de même origine : les métriques terrain LCP, INP et CLS ne
sont pas mesurées, faute de RUM. Elles naissent dans le navigateur, y compris
sur les pages publiques où aucune session n'existe. Le même mur les arrête.

## Décision

Une seconde voie, séparée de la première plutôt que greffée dessus.

Table `public.anonymous_events`, **sans colonne d'acteur** — ni `actor_id`, ni
adresse IP, ni empreinte de navigateur, ni identifiant de visite. La différence
avec `product_events` est de nature, pas de degré : `product_events` porte une
donnée pseudonyme assumée, `anonymous_events` n'en porte aucune. Rien n'y est
rattachable à une personne, donc rien n'y est à restituer ni à effacer sur
demande, et aucune cascade depuis `profiles` n'aurait de sens.

Comme en ADR-0008, aucune colonne libre : les dimensions sont des types
énumérés fermés. Y écrire l'e-mail saisi dans le formulaire de connexion qui
vient d'échouer n'est pas déconseillé, c'est refusé par le type.

L'écriture passe par une RPC exécutable par `anon`, qui exige un jeton partagé
détenu uniquement côté serveur, dans la variable d'environnement
`SELAH_ANALYTICS_TOKEN`. La base ne stocke pas ce jeton : elle stocke son seul
condensé SHA-256, dans le schéma `private`, hors de portée de `anon` comme de
`authenticated`. La RPC compare le condensé de l'argument reçu à celui-là. Un
appel sans jeton, ou avec un jeton faux, retourne `false` — la même valeur dans
les deux cas, sans message distinguant l'absence de l'erreur.

Le navigateur mesure, mais il n'appelle pas la base : il poste vers une route
serveur, qui seule détient le jeton et seule appelle la RPC. Le jeton ne
franchit jamais la frontière du serveur ; qui lit le bundle client ne l'y
trouve pas.

Les valeurs de Web Vitals sont réduites côté serveur **avant** écriture, à
trois seuils : `good`, `needs_improvement`, `poor`. Aucune valeur brute
n'atteint la base. Un LCP à la milliseconde près, croisé avec l'heure et la
page, est une empreinte d'appareil ; sa classe ne l'est pas.

La posture de lecture est celle d'ADR-0008, inchangée : RLS activée,
`revoke all` sur `anon` et `authenticated`, aucune ligne lue par un client,
restitution agrégée seulement.

### Alternative écartée : la clé `service_role`

C'est la solution évidente, et c'est pourquoi son refus doit être argumenté
plutôt qu'affirmé. La clé `service_role` contourne la RLS sur la totalité de
la base. Elle ne confère pas le droit d'écrire un compteur, elle confère celui
de tout faire : lire chaque profil, chaque demande de prière, chaque message de
room, écrire n'importe quelle ligne, en supprimer n'importe laquelle. Placée
dans l'application pour instrumenter trois événements, elle reviendrait à poser
un passe-partout sur la porte d'entrée pour ouvrir une boîte aux lettres.

Le jeton d'analytique ne permet qu'une chose : insérer une ligne de compteur
sans acteur, dans une table dont chaque colonne est une énumération fermée. Sa
compromission a une conséquence, et une seule : des compteurs empoisonnés.
Jamais une fuite, jamais une suppression, jamais une écriture ailleurs. À
bénéfice identique — les trois événements deviennent mesurables — c'est le
rayon d'explosion qui tranche.

## Conséquences

Les compteurs anonymes sont falsifiables par quiconque détient le jeton
serveur. Ce prix est accepté, et il impose une règle d'usage explicite : ils ne
servent jamais de preuve de sécurité, jamais de base de facturation, jamais
d'élément dans un litige. Aucune décision de blocage, de quota ou de sanction
ne s'appuie dessus. Ils répondent à « la courbe bouge-t-elle », pas à « qui a
fait quoi ».

Réduire les Web Vitals à trois classes coûte la distribution : aucun p75 en
millisecondes ne sortira de cette table. Restera la part des visites classées
`poor`, ce qui suffit à décider d'agir ou non ; la milliseconde exacte
n'aurait ajouté qu'une empreinte.

Ce que cette voie ne mesurera toujours pas : rien ne relie une visite anonyme à
la création de compte qui la suit. Les deux tables ne se joignent pas — c'est
le but, pas une lacune. Un taux de conversion visiteur → compte reste hors
d'atteinte au niveau individuel ; deux compteurs agrégés coexistent, sans lien
entre eux.

Enfin, la rétention suit le sort d'ADR-0008 : une fonction de purge livrée mais
non planifiée, aucun `pg_cron` n'étant installé sur ce projet. Une rétention
annoncée n'est pas une rétention appliquée tant que personne n'exécute la
purge.

## Réversibilité

Deux niveaux, l'un immédiat, l'autre total.

Immédiat, sans migration ni redéploiement : écraser le condensé stocké en
`private` par un condensé sans antécédent connu. Tout jeton existant cesse
d'être accepté dès la requête suivante et la RPC retourne `false`, sans que
rien d'autre bouge. La rotation normale du jeton emprunte exactement ce chemin,
suivie de la mise à jour de `SELAH_ANALYTICS_TOKEN` côté Vercel.

Total, dans un script, non exécuté à ce jour :

```sql
drop view if exists public.anonymous_events_daily;
drop function if exists private.anonymous_events_daily_rows();
drop function if exists public.record_anonymous_event(
  text, text, text, text);
drop function if exists private.record_anonymous_event_impl(
  text, text, text, text);
drop function if exists private.purge_anonymous_events(integer);
drop table if exists public.anonymous_events;
drop table if exists private.analytics_secret;
drop type if exists public.anonymous_event_bucket;
drop type if exists public.anonymous_event_surface;
drop type if exists public.anonymous_event_name;
```

Ni `public.product_events` ni sa RPC ne sont touchés par ce retrait : les deux
voies sont indépendantes, c'était l'objet même de la décision.

## Preuves exigées avant ouverture

1. Migration listée comme appliquée sur le projet Supabase cible, sortie copiée
   dans la revue.
2. En rôle `anon` : appel sans jeton, puis appel avec un jeton faux, `false`
   dans les deux cas, et `count(*)` identique avant et après.
3. Appel avec le jeton réel : une ligne créée, et la liste des colonnes de la
   table copiée dans la revue — aucune n'accepte un identifiant de personne. En
   `anon` comme en `authenticated`, `select` direct refusé.
4. Le jeton en clair est introuvable : absent de la base — seul le condensé, en
   `private` —, absent du dépôt, absent des logs runtime. Les commandes de
   recherche et leur sortie sont copiées.
5. Une valeur de Web Vitals posée à la limite d'un seuil traverse la route
   serveur : la ligne écrite porte une classe, jamais un nombre.
6. Rotation exercée une fois : condensé remplacé, ancien jeton refusé, nouveau
   accepté. `private.purge_anonymous_events` exécutée une fois manuellement,
   avec le nombre de lignes retourné.
7. Le responsable du traitement de la voie authentifiée reste à nommer
   (ADR-0008, point 5). Non fait à ce jour. La présente voie n'écrit aucune
   donnée personnelle : c'est à la revue de le vérifier, pas de le supposer.
