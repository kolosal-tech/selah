# ADR-0009 — Feature flags par variable d'environnement

## Statut

Accepté — 11 août 2026 — équipe technique. Implémentée dans `src/lib/flags.ts`,
qui couvre `mentorship`, `video_publication` et `analytics`.

## Contexte

Jusqu'ici, couper une fonctionnalité passait par une migration SQL. Le repli
documenté en cas d'incident sur la vidéo et le mentorat était le couple
`0015_safety_default_pause.sql` puis `0016_reenable_video_mentorship.sql` :
un changement de schéma là où il s'agissait seulement de fermer une porte.

Ce mécanisme a trois défauts. Il demande une migration appliquée à distance
pour un geste réversible. Il mélange l'état du schéma et l'état du produit.
Il n'a pas d'équivalent côté application : une page restait rendue même quand
la policy refusait l'écriture. S'y ajoute une contrainte de coût : les pages
sont rendues côté serveur et exécutent déjà 2 à 3 appels `auth.getUser()` par
navigation, donc toute lecture supplémentaire au rendu se paie à chaque page.

## Décision

Un flag est une variable d'environnement lue par `isEnabled()` dans
`src/lib/flags.ts`. Les trois variables sont `SELAH_FLAG_MENTORSHIP`,
`SELAH_FLAG_VIDEO_PUBLICATION` et `SELAH_FLAG_ANALYTICS`.

Quatre points sont fixés par le code, pas par une convention d'équipe :

- Les défauts sont identiques aux constantes qu'ils remplacent : `mentorship`
  et `video_publication` à `true`, `analytics` à `false`. Poser le module
  n'a changé aucun comportement.
- La lecture de `process.env` se fait par accès statiques dans un `switch`.
  Next remplace ces expressions à la compilation, ce qu'une indexation
  dynamique `process.env[cle]` empêcherait.
- La grammaire acceptée est étroite : `1` et `true` activent, `0` et `false`
  désactivent, après `trim()` et passage en minuscules. Toute autre valeur
  retombe sur le défaut. Une faute de frappe dans une variable Vercel n'ouvre
  donc jamais une fonctionnalité fermée : elle est ignorée.
- La liste `FEATURE_FLAGS` est un `as const` et `FeatureFlag` en dérive :
  un nom de flag inconnu ne compile pas.

Alternative écartée : une table de flags en base, lue au rendu. Elle donnerait
un interrupteur à chaud, mais ajouterait un aller-retour Postgres par
navigation, en plus des `auth.getUser()` déjà présents, sur toutes les pages
y compris celles qui n'utilisent aucun flag.

## Conséquences

Un changement de flag exige un redéploiement Vercel, de l'ordre de deux
minutes. Ce n'est pas un interrupteur à chaud : en incident, la fermeture
n'est pas instantanée.

Ne sont pas couverts, et sortent du périmètre : le ciblage par utilisateur ou
par cohorte, le déploiement progressif en pourcentage, et l'expérimentation
A/B. Aucun de ces besoins n'est exprimé aujourd'hui. L'historique des
changements de flag n'est pas conservé par l'application : la trace existe
uniquement dans l'historique des variables du projet Vercel.

Chemin d'évolution si un interrupteur à chaud devient nécessaire : ajouter une
table de flags lue une seule fois par requête, derrière un cache en mémoire du
processus avec une durée de validité courte, et garder `isEnabled()` comme
seule interface d'appel pour que les sites d'appel ne changent pas. La durée de
validité, la source d'invalidation et le comportement en cas de base
indisponible ne sont pas décidés.

## Réversibilité

Le retrait est complet et sans migration. Supprimer les trois variables du
projet Vercel ramène chaque flag à son défaut au redéploiement suivant : le
comportement redevient celui d'avant cette décision. Aucune donnée n'est en
jeu, aucun schéma n'est touché. Revenir plus loin consiste à supprimer
`src/lib/flags.ts` et à remettre les constantes en dur sur les sites d'appel.
Cette opération n'a pas été exécutée.

## Preuves exigées avant ouverture

Avant de changer un flag en production :

1. Le nom exact de la variable et la valeur posée, relus sur le projet Vercel
   cible, capturés dans la revue.
2. Un déploiement `READY` postérieur à la modification de la variable, avec
   son identifiant et son SHA. Une variable posée sans redéploiement ne
   change rien.
3. Une vérification fonctionnelle sur l'URL de production montrant l'état
   attendu de la surface concernée, et non seulement un code HTTP 200.
4. Pour une fermeture : la preuve que la voie serveur refuse aussi, et pas
   seulement que l'écran est masqué. Le flag ne remplace pas la RLS.
5. Pour `analytics` : les preuves listées dans
   `docs/adr/ADR-0008-analytique-produit.md`, qui restent exigibles.
