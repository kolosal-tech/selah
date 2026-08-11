# Objectifs de service

Portée : application Selah déployée sur https://selah-wheat.vercel.app et son
projet Supabase. Le document fixe des cibles et nomme les preuves qui manquent.
Il n'engage aucune dépense et ne décrit aucun changement appliqué.

Trois marqueurs sont employés, et un seul sens chacun :

- « non mesuré » : la cible existe, l'instrument de mesure n'existe pas.
- « à valider » : la valeur est proposée, elle n'a pas été confirmée par un
  exercice réel.
- « à nommer » : la responsabilité humaine n'est pas attribuée.

## Objectifs de service serveur

Les seuils ci-dessous sont ceux de `load-test/config.json`, champ `thresholds`.
Ils sont bloquants pendant un tir k6 : un dépassement fait échouer le test.

| Indicateur | Objectif | Clé de seuil |
| --- | --- | --- |
| Latence des parcours | p95 < 1500 ms | `http_req_duration{scenario:traffic}` |
| Taux d'échec HTTP | < 1 % | `http_req_failed{scenario:traffic}` |
| Checks réussis | > 99 % | `checks{scenario:traffic}` |
| Page témoin | p95 < 800 ms | `http_req_duration{page:manifest}` |

Les parcours couverts par le scénario `traffic` sont `/decouvrir` et le fil
authentifié `/`. `/login` sert d'entrée, `/manifest.json` de page témoin.

### Marge disponible

Mesure du 11 août 2026 en production : 22 624 requêtes, 0 % d'erreur, p95 du
trafic à environ 930 ms, jusqu'à 150 utilisateurs virtuels. Aucun palier de
rupture n'a été atteint : le test s'est arrêté à la dernière marche prévue
(`stress.steps` s'achève à 150), pas sur une dégradation.

Marge de latence restante : environ 570 ms sur le p95 avant le seuil, soit un
peu plus d'un tiers du budget. La capacité au-delà de 150 utilisateurs virtuels
est inconnue : elle n'a pas été mesurée.

## Objectifs terrain

Cibles au 75e centile, sur le trafic réel, mobile et fixe confondus :

| Indicateur | Objectif p75 | État |
| --- | --- | --- |
| LCP | <= 2,5 s | non mesuré |
| INP | <= 200 ms | non mesuré |
| CLS | <= 0,1 | non mesuré |

Aucune de ces trois valeurs n'est connue. Aucun collecteur RUM n'est installé
dans l'application : rien ne lit `PerformanceObserver` côté navigateur, rien
n'envoie de mesure, rien ne la stocke.

Brique manquante pour les mesurer, dans l'ordre :

1. Un collecteur côté client, qui observe les trois métriques et les envoie une
   fois par navigation. Le fournisseur ou la bibliothèque n'est pas décidé.
2. Un point d'entrée serveur qui accepte ces envois sans authentification et
   sans donnée personnelle.
3. Un stockage agrégé, distinct de `public.product_events`, dont le schéma
   n'accepte que des dimensions fermées.

Tant que ces trois éléments manquent, toute affirmation sur la performance
perçue est une hypothèse. Les 930 ms mesurées par k6 sont une latence serveur,
pas un LCP.

## Budgets de coût

Aucune dépense n'est engagée sans autorisation explicite. Ce qui suit sépare ce
qui est plafonné par une configuration existante de ce qui ne l'est pas.

### Plafonné

| Poste | Plafond | Mécanisme |
| --- | --- | --- |
| Minutes GitHub Actions | 0 USD | Dépense plafonnée à zéro, workflows manuels |

Conséquence : aucune exécution automatique sur `push` ou sur pull request. La
vérification reste locale, avec la séquence de `AGENTS.md`.

### Non plafonné

| Poste | Suivi actuel | Manque |
| --- | --- | --- |
| Storage Supabase | Tableau de bord, à la main | Aucun seuil, aucun relevé |
| Egress Supabase | Tableau de bord, à la main | Volume par vidéo non mesuré |
| Quota de traduction | Aucun compteur | Quota et coût non documentés |
| `public.product_events` | Aucun relevé | Purge écrite, non planifiée |

### Estimation du volume de `public.product_events`

Hypothèses, à traiter comme telles : environ 60 octets par ligne hors index, et
une ligne `session_start` par compte actif et par jour. L'index unique
`product_events_session_idx` garantit cette unicité en base.

| Comptes actifs par jour | Par jour | Par an (365 j) |
| --- | --- | --- |
| 1 000 | ~60 ko | ~22 Mo |
| 10 000 | ~600 ko | ~219 Mo |
| 100 000 | ~6 Mo | ~2,2 Go |

Ces chiffres ne couvrent que `session_start`. Les événements de première fois
sont bornés à une ligne par compte et par nom. Les événements `action_refused`
sont bornés par le plafond de 60 lignes par acteur et par minute inscrit dans
`private.record_product_event_impl`, mais leur volume réel n'est pas estimé.
La taille des index n'est pas estimée.

`private.purge_product_events` supprime au-delà de 400 jours. Elle n'est
planifiée par aucun ordonnanceur : sans appel, la table ne se purge pas.

Le drapeau `analytics` vaut `false` par défaut. Tant que
`SELAH_FLAG_ANALYTICS` n'est pas positionné et le déploiement refait, aucune
ligne n'est écrite et le volume reste nul.

## RPO et RTO

Valeurs proposées, à valider :

| Objectif | Valeur proposée | État |
| --- | --- | --- |
| RPO | 24 h | à valider |
| RTO | 4 h | à valider |

Le PITR Supabase est disponible sur le projet. Cela établit qu'une sauvegarde
existe, rien de plus. Aucune restauration n'a jamais été exercée, ni en
production ni ailleurs. Un RTO non exercé est une intention, pas un objectif.

Ce qui rendrait ces valeurs vérifiables, sans toucher à la production :

1. Restaurer un instantané dans un projet jetable, distinct du projet de
   production.
2. Chronométrer la restauration de bout en bout, y compris la reconfiguration
   des variables d'environnement et la vérification d'une lecture applicative.
3. Confirmer la fenêtre PITR réellement offerte par le plan du projet ; elle
   n'est pas relevée dans ce document.
4. Consigner la date de l'exercice et le temps mesuré, puis remplacer les deux
   valeurs ci-dessus par des valeurs mesurées.

Tant que le point 2 n'a pas été fait, le RTO de 4 h reste une supposition.

## Alertes

### Observable aujourd'hui

- Vercel Runtime Logs : les erreurs serveur et les traces des routes, en
  consultation manuelle.
- Absence de 5xx pendant un tir k6 : le seuil `http_req_failed` est bloquant
  pendant le test, donc un dépassement est visible immédiatement.
- Journaux Supabase : authentification, base et Storage, en consultation
  manuelle.

### Non observable aujourd'hui

- Aucune télémétrie d'erreur applicative. Pas de Sentry ni d'équivalent. Une
  exception côté navigateur n'est vue par personne.
- Aucune alerte automatique. Aucun canal de notification n'est branché, donc
  aucune des lignes du tableau ci-dessous ne se déclenche seule : chacune
  suppose qu'une personne regarde.
- Aucune sonde de disponibilité continue. Entre deux tirs k6, une panne totale
  ne produit aucun signal.

### Seuils

| Seuil | Signal | Responsable |
| --- | --- | --- |
| p95 des parcours > 1500 ms | Tir k6 manuel | à nommer |
| Taux de 5xx > 1 % sur 15 min | Vercel Runtime Logs, à la main | à nommer |
| Échecs d'authentification en série | Journaux Auth Supabase | à nommer |
| Storage au-delà de 80 % du quota | Tableau de bord Supabase | à nommer |
| Refus répétés en traduction | `outcome = 'refused'` dans la vue | à nommer |
| Minutes GitHub Actions non nulles | Facturation GitHub | à nommer |
| Page témoin sans réponse | Aucun signal automatique | à nommer |

Précisions sur deux lignes : le seuil k6 est
`http_req_duration{scenario:traffic}`, relevé pendant un tir et pas entre deux ;
le signal de traduction n'existe que si le drapeau `analytics` est actif, sinon
la vue reste vide.

Le document `docs/OPERATIONS_RUNBOOK.md` comporte encore des seuils et des
responsables non renseignés. Les deux fichiers doivent être mis à jour ensemble
le jour où une personne est nommée.

## Tableau de bord

Pas d'outil tiers. Le tableau de bord est un jeu de requêtes SQL nommées,
exécutées à la main sur `public.product_events_daily`.

Prérequis de lecture : la vue s'appuie sur `private.product_events_daily_rows`,
qui ne renvoie de lignes qu'aux comptes dont `profiles.role` vaut `moderateur`
ou `admin`. Un autre compte obtient zéro ligne, sans erreur : un résultat vide
n'est donc pas une preuve d'absence d'activité.

Colonnes disponibles : `day`, `name`, `surface`, `outcome`, `reason`, `lang`,
`events`, `actors`.

Limite structurelle à garder en tête : la vue est agrégée et n'expose pas
`actor_id`. Une somme de `actors` sur plusieurs jours compte plusieurs fois un
même compte actif plusieurs jours. Les sommes ci-dessous ne sont exactes que
pour les événements de première fois, qu'un index unique borne à une ligne par
compte.

### Requête `activation_quotidienne`

Inscriptions et premières actions, jour par jour, sur trente jours.

```sql
select
  day,
  sum(actors) filter (where name = 'signup_completed') as inscrits,
  sum(actors) filter (where name = 'first_feed_view') as premier_fil,
  sum(actors) filter (where name = 'first_prayer') as premiere_priere,
  sum(actors) filter (where name = 'first_publish') as premiere_publication
from public.product_events_daily
where outcome = 'ok'
  and day >= current_date - 30
group by day
order by day desc;
```

### Requête `activation_par_langue`

Même mesure, segmentée par `profiles.lang`.

```sql
select
  lang,
  sum(actors) filter (where name = 'signup_completed') as inscrits,
  sum(actors) filter (where name = 'first_feed_view') as premier_fil,
  sum(actors) filter (where name = 'first_prayer') as premiere_priere
from public.product_events_daily
where outcome = 'ok'
  and day >= current_date - 30
group by lang
order by inscrits desc nulls last;
```

### Requête `audience_quotidienne`

Comptes ayant ouvert au moins une session dans la journée.

```sql
select
  day,
  sum(actors) as comptes_actifs,
  sum(events) as sessions
from public.product_events_daily
where name = 'session_start'
group by day
order by day desc;
```

### Requête `retention_approchee`

Rapproche les inscriptions d'un jour de l'audience observée à J+1, J+7 et J+30.
Ce n'est pas une rétention par cohorte : les deux séries sont agrégées
séparément, donc rien ne garantit que les comptes actifs à J+7 soient ceux
inscrits sept jours plus tôt. À lire comme une tendance, pas comme un taux.

```sql
with audience as (
  select day, sum(actors)::numeric as comptes_actifs
  from public.product_events_daily
  where name = 'session_start'
  group by day
),
inscriptions as (
  select day, sum(actors)::numeric as inscrits
  from public.product_events_daily
  where name = 'signup_completed'
    and outcome = 'ok'
  group by day
)
select
  i.day as jour_inscription,
  i.inscrits,
  j1.comptes_actifs as actifs_j1,
  j7.comptes_actifs as actifs_j7,
  j30.comptes_actifs as actifs_j30
from inscriptions i
left join audience j1 on j1.day = i.day + 1
left join audience j7 on j7.day = i.day + 7
left join audience j30 on j30.day = i.day + 30
order by i.day desc;
```

### Requête `retention_cohorte`

Rétention exacte J1/J7/J30. Elle exige `actor_id`, que la vue n'expose pas :
elle se lit donc directement sur `public.product_events`, avec un accès base
serveur. Le client n'a aucun droit sur cette table (`revoke all` sur `anon` et
`authenticated`), et les policies refusent explicitement lecture et écriture.

```sql
with cohorte as (
  select actor_id, occurred_day as jour_inscription
  from public.product_events
  where name = 'signup_completed'
),
retours as (
  select actor_id, occurred_day
  from public.product_events
  where name = 'session_start'
)
select
  c.jour_inscription,
  count(distinct c.actor_id) as inscrits,
  count(distinct r.actor_id) filter (
    where r.occurred_day = c.jour_inscription + 1) as revenus_j1,
  count(distinct r.actor_id) filter (
    where r.occurred_day = c.jour_inscription + 7) as revenus_j7,
  count(distinct r.actor_id) filter (
    where r.occurred_day = c.jour_inscription + 30) as revenus_j30
from cohorte c
left join retours r on r.actor_id = c.actor_id
group by c.jour_inscription
order by c.jour_inscription desc;
```

### Requête `refus_par_surface`

Volume de refus par surface et par motif, sur quatorze jours.

```sql
select
  surface,
  reason,
  sum(events) as refus
from public.product_events_daily
where outcome = 'refused'
  and day >= current_date - 14
group by surface, reason
order by refus desc;
```

### Requête `taux_de_refus_par_surface`

Part des refus dans le total des événements de chaque surface. Le taux répond à
une question que le volume brut ne tranche pas : une surface peu utilisée peut
refuser beaucoup en proportion.

```sql
select
  surface,
  sum(events) filter (where outcome = 'refused') as refus,
  sum(events) filter (where outcome = 'error') as erreurs,
  sum(events) as total,
  round(
    100.0 * sum(events) filter (where outcome = 'refused')
    / nullif(sum(events), 0),
    2
  ) as taux_refus_pct
from public.product_events_daily
where day >= current_date - 14
group by surface
order by taux_refus_pct desc nulls last;
```

### Lecture des résultats

Un tableau vide peut vouloir dire trois choses distinctes : le drapeau
`analytics` est inactif, le compte de lecture n'a pas le rôle requis, ou il ne
s'est rien passé. Vérifier les deux premières avant de conclure la troisième.
