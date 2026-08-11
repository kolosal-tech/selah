# Journal d'architecture

Journal des composants à risque de Selah. Un composant, un paragraphe daté.
Chaque entrée dit quatre choses : ce qui est en place, le risque exact, ce qui
le contient aujourd'hui, et le déclencheur qui obligerait à le traiter.

## Règle de tenue

Une entrée se complète, elle ne s'efface pas. Quand un risque est traité, on
ajoute un paragraphe daté sous la même section, qui dit comment il a été
traité et par quelle preuve. On ne supprime ni ne réécrit les paragraphes
antérieurs : l'historique d'un composant fait partie de son information. Une
entrée sans preuve reste une entrée : elle porte alors la mention « non
mesuré » ou « non décidé », et dit quelle preuve manque.

## Audio WebRTC en mesh

11 août 2026. En place : les salles audio utilisent un maillage WebRTC
pair-à-pair, plafonné à 4 pairs, dans
`src/app/(app)/rooms/[id]/room-audio.tsx`. La liste `iceServers` y est vide :
ni STUN, ni TURN. Il n'y a pas de SFU. Risque exact : sans serveur STUN, un
pair derrière un NAT symétrique ne découvre pas d'adresse joignable et la
liaison n'est jamais établie ; sans TURN, aucun relais ne rattrape ce cas. Par
ailleurs, la coupure du micro s'applique côté client : un client modifié peut
ignorer un mute reçu, donc la modération audio n'est pas autoritaire. Ce qui
le contient aujourd'hui : le plafond de 4 pairs, l'entrée volontaire dans la
salle et le micro coupé par défaut. Le taux réel d'échec de connexion n'est
pas mesuré ; aucune télémétrie ICE n'existe. Déclencheur : toute salle prévue
au-delà de 4 participants, ou toute exigence de modération autoritaire, oblige
à traiter le composant. Le choix du fournisseur TURN/SFU est non décidé.

## Pipeline média sans quarantaine

11 août 2026. En place : la publication est directe. L'objet part vers
Storage, puis la ligne est insérée. Il n'existe aucun état intermédiaire
`quarantined` ou `processing`. La validation serveur porte sur le chemin
Storage, contrôlé par une expression régulière `uid/nom`, et sur
`duration_s <= 300`. Risque exact : aucun octet n'est inspecté. Le type réel
du fichier n'est pas vérifié côté serveur, il n'y a pas d'antivirus, et la
durée est celle que le client déclare. Aucun transcodage n'est fait : la
lecture dépend donc du terminal du destinataire. Ce qui le contient
aujourd'hui : le périmètre restreint des comptes qui publient et la modération
a posteriori. Déclencheur : l'ouverture du dépôt à des comptes non vérifiés
oblige à traiter le composant avant, pas après. Le fournisseur d'analyse et de
transcodage est non décidé.

## Exemption des chemins /api/ dans le proxy

11 août 2026. En place : `src/lib/public-paths.ts` renvoie `true` pour tout
chemin commençant par `/api/`, en plus de la liste explicite. Ces chemins
échappent donc à la garde globale du proxy, et chaque route API doit refaire
sa propre vérification. `src/app/api/translate/route.ts` la fait : 401 sans
session, puis 429 au-delà du quota. Risque exact : une future route ajoutée
sous `/api/` sans garde interne serait publique par accident, sans qu'aucune
étape ne s'y oppose. Ce qui le contient aujourd'hui :
`tests/proxy-public-paths.test.ts` fige le comportement du proxy — il vérifie
que `/api/translate` est public et que `/api` ne l'est pas — mais il ne
vérifie pas que chaque route porte sa garde. Le contrôle restant est donc la
revue à l'ajout. Déclencheur : toute nouvelle route sous `/api/`. La forme du
contrôle automatique — énumération des routes, test de garde par route — est
non décidée.

## Trois étages de vérification d'identité

11 août 2026. En place : l'identité est vérifiée à trois endroits — le proxy,
le layout, puis la Server Action. Chacun appelle `auth.getUser()`, soit 2 à 3
allers-retours GoTrue par navigation. Risque exact : latence ajoutée sur
chaque navigation, et dépendance de la disponibilité de GoTrue à chaque étage.
C'est un compromis assumé : la redondance de sécurité est payée en latence.
Ce qui le contient aujourd'hui : la mesure de charge du 11 août 2026 en
production — 22 624 requêtes, 0 % d'erreur, p95 trafic environ 930 ms,
jusqu'à 150 VU, aucun palier de rupture atteint. Les seuils de
`load-test/config.json` sont p95 trafic < 1500 ms, échecs < 1 %, checks
> 99 %, page témoin p95 < 800 ms. La part exacte de GoTrue dans ce p95 n'est
pas mesurée. Déclencheur : un p95 trafic qui approche 1500 ms, ou un incident
de disponibilité GoTrue, obligerait à réduire le nombre d'étages ou à
mutualiser l'appel.

## Absence de télémétrie d'erreur

11 août 2026. En place : aucun collecteur d'erreurs. Pas de Sentry ni
d'équivalent. La seule corrélation serveur passe par les Vercel Runtime Logs,
sur fenêtre glissante. Risque exact : une erreur qui n'est pas observée
pendant la fenêtre est perdue. Il n'y a ni regroupement par signature, ni
comptage, ni alerte, donc aucune manière de savoir qu'un défaut se répète.
Aucun RUM n'est en place : LCP, INP et CLS terrain sont non mesurés. Ce qui le
contient aujourd'hui : la consultation manuelle des logs après déploiement, et
le volume d'usage actuel. `docs/OPERATIONS_RUNBOOK.md` porte encore des lignes
« à définir » pour les seuils et les responsables d'alerte ; ces responsables
sont à nommer. Déclencheur : le premier incident non reproductible signalé par
un utilisateur, ou toute ouverture au-delà du cercle actuel. Le fournisseur et
le budget associé sont non décidés.

## Aucune tâche planifiée

11 août 2026. En place : rien n'est planifié. Ni `pg_cron`, ni Edge Function
programmée, ni tâche d'exploitation. Les purges existent mais s'appellent à la
main : `private.purge_product_events`, créée par
`supabase/migrations/20260811120000_product_analytics.sql` et non planifiée, et
la purge des objets Storage orphelins. Risque exact : ce qui n'est pas purgé
croît sans borne, et toute durée de rétention annoncée serait invérifiable.
L'exécution dépend d'un geste humain, donc de la mémoire de la personne qui
l'exécute. Ce qui le contient aujourd'hui : le flag `analytics` est désactivé
par défaut dans `src/lib/flags.ts`, donc `public.product_events` ne se remplit
que si `SELAH_FLAG_ANALYTICS` est activé puis le déploiement refait. La
volumétrie des objets Storage orphelins n'est pas mesurée. Au même titre, le
PITR Supabase est disponible sur le projet mais aucune restauration n'a jamais
été exercée : la durée réelle d'une restauration est non mesurée.
Déclencheur : l'activation du flag `analytics` en production, ou tout
engagement de durée de rétention pris envers un utilisateur.

## Duplication profiles.lang et profiles.locale

11 août 2026. En place : deux colonnes portent le même concept.
`profiles.lang` est modifiable par l'utilisateur. `profiles.locale` est figée à
l'inscription et reste hors du grant d'écriture. Risque exact : les deux
valeurs peuvent diverger pour un même compte, et chaque nouvelle
fonctionnalité doit choisir laquelle lire, sans règle écrite pour trancher.
Une correction de langue faite par l'utilisateur ne se propage pas à `locale`.
Ce qui le contient aujourd'hui : `locale` n'étant pas inscriptible, il n'y a
pas de course d'écriture entre les deux colonnes. La liste des lectures de
chacune n'est pas établie ici. Déclencheur : toute fonctionnalité qui décide
d'un contenu d'après la langue — traduction, notification, doublage — ou un
signalement utilisateur sur la langue affichée. La colonne qui fait autorité
est non décidée ; le choix devra s'accompagner d'une migration et d'une
recette de convergence.
