# Audit complet du SaaS vidéo chrétien Selah

Date de l’audit : 9 août 2026

Dépôt audité : /Users/mskolosalgmail.com/Developer/TIKTOK_CRETIEN/selah

Branche et révision : selah-mvp — 1704e8a

Méthode : audit statique exhaustif du dépôt, inventaire Git, lecture du code et des migrations, puis validations locales sans réseau

État du dépôt avant audit : propre

Livrable : rapport uniquement, sans modification du code applicatif

Légende des constats :

- [Vérifié] : directement établi par le dépôt ou une commande exécutée.
- [Amélioration produit] : recommandation fondée sur un écart fonctionnel ou opérationnel.
- [Choix stratégique] : décision de positionnement à prendre avant implémentation.
- [Hypothèse à confirmer] : élément impossible à valider sans environnement ou preuve externe.

Niveaux de sévérité :

- P0 — Critique : exploitation directe ou atteinte grave à la confidentialité/intégrité.
- P1 — Haute : risque important avant toute ouverture publique.
- P2 — Moyenne : dette significative, défaut de robustesse ou lacune produit.
- P3 — Faible : qualité, confort ou maintien à améliorer.

## 1. Résumé exécutif

[Vérifié] Selah est un MVP web/PWA avancé, cohérent visuellement et déjà riche en fonctionnalités chrétiennes : comptes, publications, prière, églises, mentorat, défis, salles, Sabbath et un premier parcours vidéo vertical. Il ne s’agit cependant pas encore d’un SaaS vidéo prêt pour une exploitation publique ou commerciale.

Le verdict est : **prototype fonctionnel à consolider avant bêta externe**.

Les raisons principales sont :

1. Trois vulnérabilités P0 :
   - un membre peut s’attribuer lui-même le rôle moderateur ou admin ;
   - une prière affichée comme anonyme reste directement rattachable à son auteur dans la base ;
   - une vidéo masquée par la modération demeure récupérable dans la table et dans le bucket public.
2. Quinze risques P1, notamment l’API de traduction publique et sans quota, l’absence de garde-fous mineurs/mentorat, le stockage vidéo public sans validation serveur, l’absence de limitation d’abus et une dérive entre le schéma versionné et le code multilingue.
3. Le pipeline vidéo est un transfert direct de fichier, pas une chaîne média de production : pas de transcodage, antivirus, reprise, idempotence, HLS/DASH, sous-titres ou nettoyage fiable des objets orphelins.
4. Le socle conformité est absent : politique de confidentialité, conditions, règles communautaires, cycle de rétention, export/suppression, registre des sous-traitants et preuve des droits média.
5. Les tests unitaires passent, mais les parcours critiques Auth/RLS/Storage/modération/vidéo ne sont pas couverts. Le build n’est pas hermétique : il tente de télécharger des polices Google.

Comptage consolidé de la matrice de constats :

| Sévérité | Nombre | État |
|---|---:|---|
| P0 | 3 | Bloquants avant bêta externe |
| P1 | 15 | À traiter dans les premiers lots |
| P2 | 14 | À planifier avant montée en charge |
| P3 | 3 | Entretien et finition |
| Total | 35 | Voir section 25 |

La bonne nouvelle est que la base est récupérable sans réécriture totale. L’architecture monolithique Next.js + Supabase convient à un MVP et plusieurs fondations sont saines : TypeScript strict, RLS généralisée, fonctions SQL durcies par search_path, contraintes d’unicité sur les interactions, traduction typée, identité graphique propre et tests unitaires rapides.

## 2. Périmètre, méthode et limites

### 2.1 Périmètre réellement audité

[Vérifié] Le répertoire initial /Users/mskolosalgmail.com/Developer/TIKTOK_CRETIEN n’est pas un dépôt Git. Le dépôt applicatif a été localisé dans son sous-répertoire selah à partir de ses marqueurs réels : .git, package.json, src, supabase et tests.

Ont été lus ou inspectés :

- les 144 fichiers suivis par Git ;
- les 17 routes de pages et la route API ;
- les 28 Server Actions exportées ;
- les composants, bibliothèques, scripts et ressources publiques ;
- les huit migrations SQL versionnées ;
- les quatre fichiers de tests ;
- les documents de conception, déploiement, validation et feuille de route ;
- les manifestes de dépendances et de configuration.

### 2.2 Exclusions volontaires

- Aucun secret, aucune valeur de .env.local ou .env.production n’a été lu.
- docs/COMPTES-TEST.md n’a pas été lu : le dépôt le classe comme fichier local contenant des mots de passe QA en clair.
- Aucun service de production, endpoint distant, dépôt distant ou fournisseur tiers n’a été contacté.
- Aucun script de publication, remplacement, suppression ou mutation distante n’a été exécuté.
- Aucun test k6 n’a été lancé contre une cible ; seuls les scénarios ont été inspectés.
- Aucun audit de vulnérabilités en ligne n’a été exécuté, pnpm audit ne proposant pas de mode hors ligne.
- Les politiques réellement déployées dans Supabase/Vercel ne sont pas vérifiées : l’audit décrit le dépôt versionné.
- La conformité juridique et l’accessibilité complète exigent respectivement une validation professionnelle et des tests navigateur/assistifs.

### 2.3 Principe de preuve

Les affirmations techniques viennent soit d’un fichier précis, soit d’une commande locale. Les commandes et leurs résultats sont regroupés à la section 26. Les recommandations n’ont pas été implémentées : ce document constitue la proposition à valider.

## 3. Architecture du dépôt

### 3.1 Structure

[Vérifié] Le dépôt est une application monolithique Next.js App Router, pas un monorepo.

    selah/
    ├── src/
    │   ├── app/                 pages, layouts, route API, actions et composants colocalisés
    │   ├── i18n/                configuration et dictionnaires des 12 langues
    │   └── lib/                 Supabase et fonctions métier
    ├── supabase/
    │   └── migrations/          huit migrations SQL versionnées
    ├── scripts/
    │   ├── doublage/            synthèse et publication de doublages
    │   └── tests-performance/   scénarios k6
    ├── tests/                   quatre suites Vitest
    ├── public/                  PWA, images, audio et vidéos d’accueil
    └── docs/                    décisions, déploiement, feuille de route

Le fichier pnpm-workspace.yaml ne déclare aucun package. Il ne contient que des règles allowBuilds. Il n’y a ni workspace applicatif multiple, ni package partagé, ni service backend distinct.

### 3.2 Frontend

- Framework : Next.js 16.3.0, App Router.
- Rendu : Server Components, Server Actions et 13 modules client.
- UI : React 19.2.8, Tailwind CSS 4.3.3, CSS personnalisé et lucide-react.
- État : état React local ; aucun store global ni cache de requêtes.
- Internationalisation : dictionnaires TypeScript pour 12 langues, avec prise en charge RTL.
- Distribution : application web responsive et PWA basique ; aucune application native ou Expo.

### 3.3 Backend et données

- Backend applicatif : Server Actions intégrées au monolithe.
- Route HTTP explicite : POST /api/translate.
- Backend managé : Supabase Auth, Postgres, Realtime et Storage.
- Données : 19 tables applicatives, trois vues et sept index explicites.
- Temps réel : messages de salles via Supabase Realtime.
- Absents : service média, worker, file de tâches, cron, Redis, cache serveur, bus d’événements et webhook métier.

### 3.4 Routes

| Type | Routes |
|---|---|
| Publiques | /, /decouvrir, /hors-ligne, /login, /signup |
| Authentifiées principales | /feed, /videos, /prayer, /map, /churches, /mentorship, /challenges, /sabbath |
| Communauté | /rooms, /rooms/[id] |
| Gouvernance | /moderation, /pastor |
| API | POST /api/translate |

[Vérifié] Le middleware/proxy protège les pages selon l’existence d’une session, mais autorise toutes les routes /api. Les autorisations métier reposent ensuite principalement sur les politiques RLS et, ponctuellement, sur des contrôles dans les actions.

### 3.5 Écosystème et déploiement

- Déploiement Vercel documenté, mais aucun vercel.json ni automatisme de déploiement.
- Supabase documenté comme backend, mais aucun supabase/config.toml pour une reproduction locale complète.
- Aucun Dockerfile, compose, workflow CI, healthcheck ou environnement éphémère versionné.
- packageManager fixe pnpm 11.20.0 ; aucune version Node n’est imposée par engines.

## 4. Stack technique et dépendances

### 4.1 Versions observées

| Couche | Dépendance | Version installée |
|---|---|---:|
| Runtime local | Node.js | 24.13.0 |
| Gestionnaire | pnpm | 11.20.0 |
| Framework | next | 16.3.0 |
| UI | react / react-dom | 19.2.8 |
| Backend client | @supabase/supabase-js | 2.112.1 |
| SSR Auth | @supabase/ssr | 0.12.4 |
| Icônes | lucide-react | 1.29.0 |
| CSS | tailwindcss / @tailwindcss/postcss | 4.3.3 |
| Langage | typescript | 5.9.3 |
| Qualité | eslint | 9.39.5 |
| Tests | vitest | 4.1.10 |

### 4.2 Appréciation

[Vérifié] Les dépendances installées sont cohérentes avec le code et le lockfile. L’installation hors ligne et figée réussit.

[Hypothèse à confirmer] Leur état de maintenance et leurs avis de sécurité au 9 août 2026 ne peuvent pas être déclarés à jour sans interroger les registres et bases d’avis. Le présent audit ne confond donc pas la résolution réussie du lockfile avec un audit SCA.

### 4.3 Dépendances implicites et services attendus

- Supabase Auth pour l’inscription, la connexion et les sessions.
- Postgres/RLS pour l’autorisation fine.
- Supabase Storage pour les vidéos et miniatures.
- Supabase Realtime pour les salles.
- Un fournisseur de traduction configurable par URL et clé.
- ElevenLabs dans certains scripts de doublage hors parcours web.
- Google Fonts au moment du build, ce qui empêche un build sans réseau.

## 5. Cartographie fonctionnelle

### 5.1 Comptes et identité

| Fonction | État | Maturité | Preuve/observation |
|---|---|---|---|
| Inscription email/mot de passe | Présent | Base | /signup et Supabase Auth |
| Connexion/déconnexion/session | Présent | Base | /login, logout et proxy |
| Confirmation email | Partiel | Base | erreurs et redirections prévues, parcours non testé |
| Profil automatique | Présent | Base | trigger handle_new_user |
| Rôles membre/leader/pasteur/moderateur/admin | Présent | Dangereux | enum et colonne role, mais auto-élévation possible |
| Profil public et préférences | Partiel | Prototype | profil DB, pas de vraie page paramètres |
| Locale utilisateur | Cassé | Prototype | le code écrit locale, la migration définit lang |
| OAuth/social login | Absent | — | aucun provider/parcours |
| Réinitialisation de mot de passe | Absent | — | aucun écran |
| MFA, appareils et sessions | Absent | — | aucun parcours |
| Export/suppression de compte | Absent | — | aucune action ni procédure |
| Blocage/mise en sourdine | Absent | — | aucun modèle de données |
| Âge/consentement parental | Absent | — | aucun champ ni contrôle |

### 5.2 Vidéo

| Fonction | État | Maturité | Preuve/observation |
|---|---|---|---|
| Upload caméra ou fichier | Présent | Prototype | transfert direct vers Storage |
| Upload par lot | Présent | Prototype | script/composant dédié |
| Miniature | Présent | Prototype | extraction canvas côté navigateur |
| Limites type/taille/durée | Partiel | Fragile | contrôle client, règles incohérentes 50 Mo/180 s/300 s |
| Validation serveur du média | Absent | — | pas de signature, codec, virus ou métadonnées |
| Transcodage multi-format | Absent | — | fichier source servi directement |
| Streaming adaptatif HLS/DASH | Absent | — | MP4/WebM direct |
| Reprise/progression/annulation | Absent | — | upload monolithique |
| Brouillon/planification/visibilité | Absent | — | publication immédiate |
| Suppression par l’auteur | Absent | — | aucune UI/action complète |
| Sous-titres/transcription | Absent | — | aucun modèle ni lecteur |
| Réactions/commentaires/prière | Présent | Base | tables et actions dédiées |
| Signalement/masquage | Partiel | Non sûr | file vidéo et champ hidden, contournables |
| Analytics vidéo | Absent | — | view_count inutilisé, aucun watch-time |

### 5.3 Social

| Fonction | État | Maturité | Preuve/observation |
|---|---|---|---|
| Flux vidéo vertical | Présent | Prototype | /videos et videos_feed |
| Flux texte | Présent | Base | /feed, limite fixe à 50 |
| Amen, commentaires et prière | Présent | Base | interactions et compteurs |
| Suivi d’auteurs | Partiel | Prototype | stockage et bouton, sans flux Abonnements |
| Partage | Présent | Base | Web Share/fallback |
| Recherche | Absent | — | aucune route ni index |
| Hashtags/catégories navigables | Absent | — | catégories statiques seulement |
| Favoris/historique/playlists | Absent | — | aucun modèle |
| Pas intéressé/masquer un auteur | Absent | — | aucun contrôle |
| Notifications | Absent | — | pastille décorative seulement |
| Messagerie privée | Absent | — | salles publiques uniquement |
| Groupes/communautés | Absent | — | aucune entité dédiée |

### 5.4 Fonctions chrétiennes

| Fonction | État | Maturité | Risque ou manque |
|---|---|---|---|
| Mur de prière | Présent | Base | anonymat non garanti |
| Carte d’intercession | Présent | Base | agrégation pays, risque petits nombres |
| Églises et pulse | Présent | Prototype | annuaire/pulse, gestion limitée |
| Mentorat | Présent | Prototype | auto-déclaration, aucune vérification |
| Défis et séries | Présent | Prototype | check-in manipulable directement |
| Salles de prière/texte | Présent | Prototype | pas d’audio live, salle fermée encore écrivable |
| Mode Sabbath | Présent | Base | masque l’app, sans notifications réelles à couper |
| Catégories sermons/témoignages/prière | Présent | Base | classification simple |
| Multilingue 12 langues | Partiel | Base | UI solide, persistance/traductions en dérive |
| Verset du jour dédié | Absent | — | aucune route/source dédiée |
| Questions de foi sécurisées | Absent | — | aucune gouvernance théologique |
| Jeunesse/famille | Absent | — | aucune protection spécifique |
| Profils d’organisations/événements | Absent | — | modèle insuffisant |
| Dons aux églises/créateurs | Absent | — | aucune monétisation |

### 5.5 Monétisation et SaaS

[Vérifié] La monétisation est entièrement absente du dépôt.

| Domaine | État |
|---|---|
| Plans et abonnements | Absent |
| Paiements et webhooks | Absent |
| Factures, taxes et remboursements | Absent |
| Quotas/entitlements | Absent |
| Publicité | Absente |
| Dons et pourboires | Absents |
| Revenus créateurs/églises | Absents |
| Tableau de bord business | Absent |

[Choix stratégique] Avant d’ajouter un fournisseur de paiement, Selah doit choisir son modèle : abonnement B2C sans publicité, offre églises/organisations, dons encadrés, ou combinaison. La collecte de dons religieux, la rémunération des créateurs et la présence de mineurs changent fortement les obligations juridiques et opérationnelles.

## 6. Architecture des données

### 6.1 Modèle final versionné

| # | Table | Rôle | Risques structurants |
|---:|---|---|---|
| 1 | profiles | identité, rôle, pays, église, Sabbath, séries | rôle modifiable par le propriétaire |
| 2 | churches | annuaire d’églises | gouvernance d’édition limitée |
| 3 | posts | publications texte | modération partielle |
| 4 | amens | réactions aux posts | relation correcte par unicité |
| 5 | comments | commentaires texte | compteur non décrémenté |
| 6 | prayer_requests | demandes de prière | anonymat contournable |
| 7 | prayer_actions | intercessions | données de pays/temps |
| 8 | mentorships | demandes/relations | sécurité des personnes absente |
| 9 | mentor_offers | disponibilité mentor | upsert incompatible avec RLS update |
| 10 | reports | signalements | cible/status/intégrité insuffisants |
| 11 | videos | métadonnées et compteurs vidéo | champs sensibles modifiables à l’insertion |
| 12 | video_amens | réactions vidéo | index utilisateur manquant |
| 13 | prayer_rooms | salles | état non imposé à l’écriture |
| 14 | room_messages | messages temps réel | abus/rétention non couverts |
| 15 | challenges | défis | création largement ouverte |
| 16 | challenge_checkins | participation | jour déclaratif/manipulable |
| 17 | video_comments | commentaires vidéo | modération limitée |
| 18 | video_prayers | prières vidéo | index utilisateur manquant |
| 19 | follows | relations de suivi | peu exploitées par le produit |

Vues finales :

- intercession_map : agrégats par pays ;
- church_pulse : agrégats d’activité par église ;
- videos_feed : score temporel et diversification par auteur.

### 6.2 Intégrité et sécurité positives

- RLS activée sur les 19 tables applicatives.
- Politiques Storage présentes sur le bucket vidéo.
- Les fonctions security definer observées fixent search_path=public.
- Les fonctions de trigger sensibles sont révoquées au public.
- Plusieurs interactions disposent de clés uniques, réduisant les doubles réactions.
- Les compteurs vidéo sont mis à jour atomiquement par trigger.
- L’upload Storage est borné au dossier de l’utilisateur par politique.

### 6.3 Défauts d’intégrité

1. La politique profiles update autorise toutes les colonnes de sa propre ligne ; le rôle n’est pas séparé des préférences utilisateur.
2. reports n’impose pas exactement une cible, ni une longueur de raison, ni un anti-doublon, ni une rétention probante.
3. bump_comment incrémente à l’insertion sans branche de décrément à la suppression.
4. touch_streak effectue une lecture puis une mise à jour sans verrou de ligne, donc deux requêtes concurrentes peuvent perdre un incrément.
5. mentor_offers est utilisé par upsert alors que les politiques autorisent insertion et suppression, pas mise à jour.
6. room_messages ne vérifie pas que la salle est ouverte.
7. challenge_checkins accepte un jour client arbitraire via accès direct à Supabase.
8. Les suppressions en cascade en base ne nettoient pas les objets Storage.

### 6.4 Dérive de schéma

[Vérifié] Le code et la documentation multilingue utilisent profiles.locale et video_translations. Les migrations versionnées fournissent profiles.lang et ne créent aucune table video_translations. L’action de changement de langue ignore l’erreur retournée. Un environnement recréé exclusivement depuis les migrations ne peut donc pas garantir le comportement décrit.

### 6.5 Indexation et montée en charge

Les index explicites sont insuffisants pour les accès prévus. Priorités proposées :

- video_amens(user_id, video_id) ;
- video_prayers(user_id, video_id) ;
- follows(follower_id, followed_id) et chemin inverse selon les requêtes ;
- profiles(church_id) ;
- reports(status, created_at desc) ;
- videos(author_id, created_at desc) ;
- prayer_actions(created_at, country) ;
- room_messages(room_id, created_at desc) ;
- challenge_checkins(challenge_id, user_id, day).

[Hypothèse à confirmer] Le gain réel doit être mesuré par EXPLAIN ANALYZE sur une copie représentative ; aucun volume ni plan de requête de production n’était disponible.

## 7. Flux vidéo de bout en bout

### 7.1 Flux actuel

    Navigateur
      → contrôle client du type, de la taille et de la durée
      → génération locale d’une miniature canvas
      → upload direct dans le bucket Supabase public
      → insertion immédiate dans videos
      → lecture MP4/WebM directe dans le flux

### 7.2 Upload

- Le composant unitaire annonce 50 Mo et 180 secondes.
- Le chemin par lot et la contrainte de base tolèrent jusqu’à 300 secondes.
- Le studio présente aussi le produit comme une expérience d’une minute.
- Le MIME vient du navigateur et aucune vérification des octets magiques n’est faite côté serveur.
- Aucun antivirus, contrôle codec, dimension, bitrate, piste audio ou nettoyage de métadonnées n’existe.
- Le fichier est public avant la création complète de la publication et avant modération.
- L’upload n’est ni multipart, ni reprenable, ni annulable, ni idempotent.

### 7.3 Traitement

[Vérifié] Il n’existe aucun job asynchrone, file de tâches, worker ou service de transcodage. La miniature est créée côté client. Il n’y a pas de normalisation portrait, extraction audio, transcription, sous-titres, manifeste HLS/DASH, déclinaison bas débit ou vérification de droits.

### 7.4 Échecs et cohérence

- Si l’insertion DB échoue après l’upload, l’objet reste orphelin.
- Une nouvelle tentative par lot crée un nouvel UUID et peut dupliquer les objets.
- Si la sonde média échoue, certains chemins continuent avec une durée nulle.
- Il n’existe pas de job de réconciliation DB/Storage.
- Il n’existe pas de suppression utilisateur complète ni de procédure de purge.

### 7.5 Lecture et coûts

- Le flux sert directement le média original public.
- Il n’y a ni bitrate adaptatif, ni cache/CDN réglé dans le dépôt, ni mode économie de données du lecteur.
- La lecture automatique et la boucle peuvent consommer beaucoup de données.
- Le flux ne collecte pas le démarrage, la complétion ou le temps regardé ; view_count n’est pas exploité.

### 7.6 Ressources d’accueil

[Vérifié] Le répertoire public représente 6 402 452 octets, soit environ 6,11 Mio. Deux vidéos d’accueil d’environ 10 secondes sont présentes :

- une vidéo H.264/AAC 1280×720 d’environ 2,812 Mo ;
- une vidéo H.264/AAC 720×1280 d’environ 2,711 Mo.

Les deux éléments vidéo peuvent être rendus avec autoplay alors qu’un seul est masqué visuellement selon le viewport. Cela peut déclencher un double transfert inutile. Les fonds pèsent 598 026 octets, soit environ 584 Kio, et l’audio d’ambiance 264 167 octets pour environ 32 secondes.

## 8. Algorithme de recommandation

### 8.1 Algorithme actuel

[Vérifié] La vue videos_feed applique un score global :

    (amen_count × 3 + prayer_count × 5 + comment_count × 2 + 1)
    / (âge_en_heures + 2) puissance 1,35

Elle attribue aussi un rang par auteur. L’application trie ensuite par rang_auteur croissant, score décroissant et renvoie 24 éléments par page.

### 8.2 Forces

- La décroissance temporelle favorise la fraîcheur.
- La diversification par auteur limite un flux entièrement monopolisé par un seul compte.
- La formule est lisible et facile à expliquer.
- Le produit ne collecte pas encore un historique détaillé de visionnage, ce qui limite la collecte comportementale.

### 8.3 Faiblesses

- Aucun signal personnel : langue, centres d’intérêt, suivi, historique, complétion ou masquage.
- Follows n’influence pas le flux.
- Aucun contrôle Flux chronologique, Abonnements ou Pas intéressé.
- Les interactions peuvent être automatisées par des comptes Sybil.
- Des compteurs peuvent être injectés à l’insertion directe d’une vidéo.
- La pagination par offset est instable car now() fait évoluer le score et aucun départage immuable final n’est défini.
- La vue effectue score et fenêtre sur le corpus à chaque requête ; elle ne constitue pas une architecture à grande échelle.
- Le chargement initial récupère tous les identifiants de likes, prières et suivis de l’utilisateur sans borne.

### 8.4 Évolution progressive recommandée

**V1 — sûre et déterministe**

- Corriger l’autorité sur les compteurs.
- Ajouter un tri stable score, created_at, id.
- Passer à une pagination par curseur.
- Proposer trois modes explicites : Pour toi, Abonnements, Récent.
- Ajouter Pas intéressé, Masquer cet auteur et Déjà vu local.
- Introduire des plafonds par auteur et une diversité de langue/catégorie.

**V2 — personnalisée mais minimisée**

- Produire des événements sobres : impression, démarrage, 25/50/95 %, interaction positive, masquage.
- Appliquer une durée de rétention courte et documentée.
- Construire un score pondéré simple et auditable par cohorte, sans profil sensible.
- Ajouter exploration contrôlée et quotas pour nouveaux créateurs.

**V3 — scalable et gouvernée**

- Séparer génération de candidats, filtrage sécurité et classement.
- Calculer des candidats préagrégés/materialisés.
- Évaluer qualité, diversité, exposition créateurs et risques de chambres d’écho.
- Prévoir explications et possibilité de revenir au chronologique.
- N’envisager du ML qu’après un volume suffisant et une revue de protection des données.

[Choix stratégique] Un produit chrétien ne doit pas optimiser uniquement le temps de visionnage. Les objectifs à arbitrer explicitement sont : édification, diversité, sécurité, qualité théologique, découverte de communautés et bien-être numérique.

## 9. Sécurité applicative

### 9.1 Vulnérabilités critiques

| ID | Constat | Preuve | Scénario d’exploitation | Impact | Correction proposée |
|---|---|---|---|---|---|
| F-001 / P0 | Auto-élévation de rôle | supabase/migrations/0001_selah_core.sql, politique profiles update ; role défini dans la même table | Un membre connecté met sa propre colonne role à moderateur ou admin via le client Supabase, puis appelle les actions qui font confiance à ce rôle | Prise de contrôle de la modération, atteinte à l’intégrité et à la confiance | Interdire role et tous les champs privilégiés aux écritures utilisateur ; RPC/admin séparée, journalisée et testée |
| F-002 / P0 | Fausse promesse d’anonymat des prières | prayer_requests conserve author_id ; SELECT ouvert à tout utilisateur authentifié ; /prayer masque seulement le nom dans l’UI | Un utilisateur interroge directement prayer_requests avec la relation profiles et identifie l’auteur d’une prière sensible | Révélation de convictions, détresse, santé ou situation familiale | Retirer author_id des lectures publiques par vue sûre/RPC ; séparer identité chiffrée/restreinte ; informer clairement l’auteur |
| F-003 / P0 | Vidéos masquées toujours accessibles | bucket videos public ; SELECT de la table videos ouvert ; le champ hidden n’est filtré que dans videos_feed | Un utilisateur conserve l’URL publique ou interroge la table de base après masquage | Contenu abusif ou illégal encore distribuable | Bucket privé, URLs signées courtes, politique SELECT filtrant hidden, quarantaine et suppression/purge contrôlée |

### 9.2 Risques élevés

| ID | Risque | Scénario et impact | Difficulté | Risque de régression |
|---|---|---|---|---|
| F-004 / P1 | INSERT vidéo trop permissif | Un client authentifié fixe created_at, compteurs ou hidden et manipule le classement ; une date future peut aussi déstabiliser le calcul | Moyenne | Moyen : adapter upload et batch |
| F-005 / P1 | Média public validé côté client seulement | Un fichier mal typé, surdimensionné ou contenant des métadonnées sensibles est publié avant contrôle | Élevée | Élevé : changement de pipeline |
| F-006 / P1 | Traduction publique, non bornée | Un bot envoie de gros textes en boucle sur POST /api/translate et consomme le quota du fournisseur ; le texte utilisateur est transféré à un tiers sans contrôle explicite | Faible à moyenne | Faible |
| F-007 / P1 | Protection des mineurs et mentorat absente | Un adulte se déclare mentor sans vérification, échange dans les espaces communautaires et cible un mineur sans blocage ou signalement adapté | Élevée | Élevé : règles produit et juridiques |
| F-008 / P1 | Modération incomplète et non probante | Les signalements sont peu contraints, sans dossier, sanction, appel, SLA ou journal ; les preuves peuvent disparaître par cascade | Élevée | Moyen |
| F-009 / P1 | Salles fermées encore écrivable | Un membre publie via Realtime/insert après fermeture ; absence de rate limit et de modération temps réel | Moyenne | Moyen |
| F-010 / P1 | Tableau pasteur sans autorisation métier | Tout membre authentifié rattaché à une église peut voir les agrégats chargés par /pastor ; la page lit le rôle mais ne le vérifie pas | Faible | Faible |
| F-011 / P1 | Contrat schéma/code multilingue divergent | Une installation neuve échoue sur locale/video_translations, tandis que les erreurs sont ignorées | Moyenne | Moyen |
| F-012 / P1 | Objets Storage orphelins et essais non idempotents | Une erreur DB ou une relance laisse plusieurs objets publics non référencés et coûteux | Moyenne | Moyen |
| F-013 / P1 | Socle juridique/confidentialité absent | Données religieuses et contenus personnels sont traités sans politique, rétention, export/suppression ou registre des tiers | Élevée | Élevé |
| F-014 / P1 | Secrets fragilisés dans les scripts | Des scripts recherchent une clé ElevenLabs dans les environnements de processus et acceptent un mot de passe en argument de ligne de commande | Faible | Faible |
| F-015 / P1 | Build non hermétique et absence de CI | La compilation dépend de Google Fonts et aucun pipeline n’empêche une livraison non testée | Moyenne | Faible |
| F-016 / P1 | Aucune observabilité, sauvegarde testée ou PRA | Une panne, un abus ou une perte de données peut ne pas être détecté ni restauré dans un délai connu | Élevée | Moyen |
| F-017 / P1 | Aucun anti-abus transversal | Connexion, inscription, traductions, uploads, réactions, commentaires et messages n’ont pas de quota/rate limit applicatif | Moyenne | Moyen |
| F-018 / P1 | Classement instable et non scalable | Offset + score dépendant de now(), vue globale et compteurs manipulables créent doublons, omissions et amplification abusive | Élevée | Moyen |

### 9.3 Authentification, autorisation et sessions

- L’authentification email/mot de passe et la synchronisation de session sont présentes.
- La protection par session ne remplace pas l’autorisation métier ; /pastor illustre cette confusion.
- Les rôles sont stockés avec les préférences dans profiles, ce qui rend leur isolation impossible avec la politique actuelle.
- Aucun MFA, récupération de mot de passe, gestion des appareils, révocation de sessions ou historique de sécurité n’est exposé.
- Les erreurs Supabase brutes sont renvoyées dans les paramètres d’URL puis affichées, ce qui peut révéler des détails techniques et facilite l’énumération selon les messages du fournisseur.

### 9.4 Injection, XSS, CSRF et entrées

Points favorables :

- aucune utilisation de dangerouslySetInnerHTML détectée ;
- React échappe les contenus affichés ;
- les accès applicatifs utilisent le query builder Supabase, sans concaténation SQL utilisateur détectée ;
- la politique Storage impose le premier segment de chemin correspondant à l’utilisateur.

Points à corriger :

- plusieurs Server Actions ne vérifient ni longueur, ni normalisation, ni cadence des champs ;
- la route de traduction n’impose pas de taille maximale, locale autorisée ou authentification ;
- les mutations reposent sur les protections Server Actions/SameSite et RLS, sans stratégie CSRF explicitement testée ;
- les erreurs de base sont souvent ignorées, ce qui produit des états UI mensongers.

### 9.5 En-têtes et navigateur

[Vérifié] next.config.ts ne définit pas de politique CSP, HSTS, frame-ancestors/X-Frame-Options, Permissions-Policy ni Referrer-Policy. Leur présence éventuelle au niveau Vercel n’est pas versionnée et n’a pas été vérifiée.

Recommandation : versionner une stratégie d’en-têtes, commencer par un rapport CSP, supprimer les dépendances de polices distantes au build, puis activer une CSP restrictive après inventaire des sources Supabase/média.

### 9.6 Secrets et chaîne d’approvisionnement

- Aucun motif courant de jeton à forte entropie n’a été trouvé dans les fichiers suivis par Git lors du scan ciblé.
- Ce résultat ne prouve pas l’absence de tout secret : il ne remplace pas Gitleaks/TruffleHog ni l’historique Git complet.
- Les scripts de doublage inspectent ps axeww pour retrouver une clé d’un autre processus, pratique à supprimer.
- Les scripts de publication permettent --mot-de-passe, ce qui expose la valeur dans l’historique et la liste des processus.
- La bonne cible est le trousseau macOS ou un secret injecté par descripteur/fichier éphémère avec permissions strictes, jamais une valeur en argument.

## 10. Modération, confiance et sécurité communautaire

### 10.1 État actuel

[Vérifié] Le produit offre un signalement générique et une file de modération vidéo permettant de masquer un contenu. reportPost existe comme action mais n’est pas raccordée à une expérience complète. Les commentaires ne disposent pas d’un circuit de signalement visible. Aucun mécanisme complet de blocage, mise en sourdine, sanction, appel ou conservation de preuve n’est versionné.

### 10.2 Lacunes

- Taxonomie insuffisante : violence, haine, nudité, harcèlement, automutilation, fraude, désinformation religieuse dangereuse, exploitation de mineurs, droits d’auteur.
- Aucun niveau de gravité, priorité, assignation, SLA ou escalade d’urgence.
- Aucun journal immuable des décisions et changements de rôle.
- Aucun état de dossier reliant signalement, contenu, auteur, preuve, décision, sanction et appel.
- Suppressions en cascade susceptibles de retirer les éléments nécessaires à l’audit.
- Aucun strike, suspension temporaire, bannissement, restriction de portée ou gel d’upload.
- Aucun outil pour empêcher le contact mentor/mineur, bloquer un utilisateur ou signaler une conversation.
- Pas de limitation de cadence ou détection de brigading.
- Le masquage vidéo ne retire pas réellement l’accès au média.

### 10.3 Plan de sécurité communautaire

Avant bêta :

1. définir les règles communautaires et une taxonomie de signalement ;
2. corriger le stockage privé et la visibilité des contenus masqués ;
3. ajouter block/mute/report partout où des personnes interagissent ;
4. séparer dossiers de modération et contenus, avec conservation maîtrisée ;
5. journaliser rôles, décisions et sanctions ;
6. suspendre le mentorat ouvert tant que vérification, âge et procédures ne sont pas définis ;
7. créer une procédure d’urgence et une procédure d’appel ;
8. tester les politiques RLS comme attaquant, membre, modérateur et administrateur.

[Choix stratégique] Le niveau d’ouverture aux mineurs et le rôle exact des mentors doivent être décidés avant conception. Une simple case déclarative n’est pas une mesure de protection.

## 11. Confidentialité, conformité et droits

### 11.1 Données observées

Le dépôt prévoit le traitement de :

- email et identifiants Auth ;
- nom d’utilisateur, nom affiché, langue, pays, rôle et église ;
- appartenance communautaire et statut Sabbath ;
- texte des prières, publications, commentaires et messages ;
- image, voix et contenu des vidéos ;
- réactions, suivis, séries et participations ;
- pays dérivé d’un en-tête géographique ;
- signalements et décisions de modération.

[Vérifié] Les prières et l’activité religieuse peuvent révéler des convictions religieuses et parfois des informations de santé, famille ou détresse. Il faut donc les traiter comme données particulièrement sensibles dans la conception, indépendamment de la qualification juridique finale.

### 11.2 Éléments absents du dépôt

- politique de confidentialité ;
- conditions d’utilisation ;
- règles communautaires ;
- finalités et bases légales ;
- version du consentement/charte ;
- politique de rétention et purge ;
- export, accès, rectification, suppression, portabilité et opposition ;
- registre des sous-traitants et transferts ;
- politique cookies/traceurs ;
- procédure mineurs et consentement parental ;
- registre des droits sur sermons, musiques, images et voix ;
- procédure de notification d’incident.

Le consentement à une charte ne vaut pas consentement de confidentialité et n’est pas versionné.

### 11.3 Risques spécifiques

- Une prière anonyme est techniquement identifiable.
- Une agrégation cartographique avec de faibles effectifs peut réidentifier un participant.
- Le fournisseur de traduction reçoit du texte utilisateur ; les catégories de texte autorisées et la base de transfert ne sont pas documentées.
- Le bucket public rend les URLs diffusables hors produit.
- Aucune durée de conservation ne borne messages, prières, vidéos et signalements.
- Aucun mécanisme ne nettoie les objets après suppression logique ou relationnelle.

### 11.4 Décisions à faire valider

- Âge minimal, présence éventuelle de mineurs et responsabilités parentales.
- Territoires de lancement et cadre applicable.
- Finalités exactes des données religieuses et durée de conservation.
- Hébergement, transferts et sous-traitants.
- Dons, reçus, fiscalité et rémunération éventuelle.
- Statut éditorial de Selah face aux contenus théologiques et illégaux.
- Licence accordée par les créateurs et traitement de la musique.

Ce rapport n’est pas un avis juridique. RGPD, DSA, ePrivacy, COPPA/équivalents, règles des stores, droit d’auteur et réglementation des dons doivent être validés par des professionnels compétents pour les pays visés.

## 12. UX, design et confiance

### 12.1 Forces observées

- Conception clairement mobile-first avec 100dvh et safe areas.
- Identité visuelle sombre, or/teal et surfaces vitrées cohérentes.
- Navigation dédiée aux usages spirituels plutôt qu’une simple copie nominale d’un réseau social.
- Vidéo muette par défaut.
- Dictionnaires centralisés et RTL.
- Réduction partielle des mouvements et suppression du fond vidéo selon save-data.
- Commandes clavier haut/bas dans le flux vidéo.
- Mode Sabbath distinctif et cohérent avec le positionnement.

### 12.2 Frictions

- Pas d’onboarding d’intérêts, langue, église, sécurité ou préférences vidéo.
- Pas de page paramètres/profil complète.
- Pas de recherche, favoris, historique ou flux Abonnements.
- Peu d’états loading/error structurés ; aucun loading.tsx ou error.tsx de route.
- Les erreurs de mutations sont souvent silencieuses ou trop techniques.
- L’upload affiche des limites incohérentes selon l’écran.
- Le lien Modération est montré sans filtrage de rôle.
- Le tableau Pasteur porte un nom privilégié sans vraie garde d’accès.
- Des chaînes françaises restent en dur dans l’uploader par lot et le libellé de temps Sabbath.
- Le sélecteur de pays n’est pas exhaustif malgré une promesse large.

### 12.3 Signaux de confiance problématiques

[Vérifié] La liste des salles fabrique un nombre d’auditeurs selon la position de la carte, avec une formule du type 12 + index × 7. L’en-tête affiche aussi une pastille permanente de notification alors qu’aucun système de notification n’existe. Ces éléments doivent être supprimés ou clairement marqués comme démonstration ; un produit spirituel ne doit pas simuler de preuve sociale.

### 12.4 Identité produit

[Vérifié] Les couleurs, contenus, concepts Sabbath/prière/église et compositions constituent une identité originale. Certains commentaires et gestes reproduisent explicitement des conventions Reels/TikTok. Ce n’est pas en soi une copie de marque, mais la version mature devrait définir son propre vocabulaire de mouvement, de découverte et de bien-être numérique.

## 13. Accessibilité

### 13.1 Points favorables

- Langue et direction sont prises en compte.
- Plusieurs boutons ont des libellés aria.
- Les icônes décoratives sont généralement séparées du texte.
- prefers-reduced-motion est partiellement pris en charge.
- Le flux répond aux flèches du clavier.

### 13.2 Écarts prioritaires

| Écart | Effet utilisateur | Recommandation |
|---|---|---|
| Champs avec placeholder sans label | Nom accessible fragile et perte de contexte | label explicite associé ou aria-labelledby |
| Vidéo cliquable non focalisable | Contrôle son inaccessible au clavier | vrai bouton, commandes natives/ARIA |
| Aucun sous-titre/transcript | Exclusion des personnes sourdes et contexte silencieux | pipeline captions, piste WebVTT, transcript |
| Panneau commentaires sans rôle dialog | Navigation lecteur d’écran et focus non contenus | dialog/aria-modal, piège de focus, Escape, restauration |
| Toast sans aria-live | Confirmation/erreur non annoncée | région live polie/alerte selon gravité |
| Cibles parfois sous 44 px | Difficulté motrice/tactile | taille minimale et espacement |
| Animations d’onde persistantes | reduced-motion incomplet | désactiver toutes les boucles décoratives |
| Navigation sans aria-current | Position courante ambiguë | signaler l’onglet actif |
| Autoplay en boucle | Charge cognitive et données | préférence, pause persistante, économie de données |

[Hypothèse à confirmer] Les contrastes sont déclarés satisfaisants dans la documentation historique, mais aucune mesure automatisée ni test navigateur n’a été exécuté pendant cet audit. Ils doivent être mesurés sur les états normal, hover, disabled, erreur et texte sur vidéo.

Objectif minimal recommandé : WCAG 2.2 niveau AA, tests clavier complets, VoiceOver mobile/desktop, zoom 200 %, contraste automatisé et manuel, puis parcours vidéo sous-titré.

## 14. Performance, scalabilité et coûts

### 14.1 Frontend

- Les médias d’accueil dominent le poids public.
- Deux vidéos autoplay peuvent être demandées pour un seul viewport.
- Le flux sert les sources originales et ne propose pas de variante bas débit.
- Les composants principaux sont volumineux et client-side, notamment vertical-feed.
- Aucune analyse de bundle versionnée ni budget de performance.
- Les polices distantes rendent le build dépendant du réseau.

### 14.2 Base et requêtes

- videos_feed recalcule un score temporel et un row_number sur le corpus.
- La pagination offset avec score mouvant devient coûteuse et instable.
- Le flux initial charge sans borne les identifiants d’interactions de l’utilisateur.
- /challenges charge tous les check-ins.
- /feed limite à 50 mais ne pagine pas.
- church_pulse combine des sous-requêtes corrélées et manque d’index de liaison.

### 14.3 Storage et bande passante

- Un original public est la seule version distribuée.
- Pas de quotas utilisateur, rétention, purge d’orphelins ou lifecycle.
- Les réessais peuvent multiplier les objets.
- Pas de mesure de stockage, egress, coût par vidéo ou alerte budgétaire.

### 14.4 Architecture de montée en charge proposée

1. Stabiliser les requêtes et ajouter les index sur preuves EXPLAIN.
2. Passer le flux à une pagination curseur.
3. Créer une table d’état média et un pipeline asynchrone idempotent.
4. Publier des variantes HLS avec miniature et sous-titres, dans un bucket privé/CDN.
5. Matérialiser les candidats de flux et séparer génération/classement.
6. Mettre quotas, métriques et budgets par organisation.
7. Tester avec données synthétiques représentatives avant tout déploiement.

## 15. Qualité du code et architecture interne

### 15.1 Forces

- TypeScript strict.
- Dictionnaires typés qui empêchent l’oubli d’une clé de langue à la compilation.
- Fonctions métier pures pour identifiant, Sabbath, séries et défis.
- Bonne centralisation des clients Supabase SSR/navigateur.
- Migrations séquentielles lisibles.
- Tests unitaires rapides et déterministes.

### 15.2 Dette

- src/app/vertical-feed.tsx approche 927 lignes.
- src/app/actions.ts approche 462 lignes.
- Les composants d’upload unitaire et par lot approchent respectivement 428 et 397 lignes.
- UI, requêtes, état, effets réseau, gestures et règles métier sont mélangés.
- La logique upload/thumbnail/Storage est dupliquée.
- De nombreuses erreurs Supabase sont ignorées.
- Les types de base sont souvent inférés ou forcés, sans types Supabase générés.
- reportPost et deleteVideoComment sont exportées sans parcours complet observé.
- view_count existe sans instrumentation.
- Des scripts codent des URLs, utilisateurs et identifiants de production.
- Un script contient un chemin temporaire Claude spécifique à une machine.

### 15.3 Cible raisonnable

Sans transformer prématurément le MVP en microservices :

- séparer actions par domaine : auth, video, social, prayer, moderation ;
- introduire un module media avec contrats upload/publish/delete ;
- générer les types Supabase depuis le schéma ;
- standardiser Result/erreurs et télémétrie ;
- extraire les hooks du lecteur et les panneaux interactifs ;
- créer des tests de contrat schéma/RLS ;
- garder Next.js monolithique tant que les besoins de média asynchrone ne justifient pas un worker séparé.

## 16. Tests et validation fonctionnelle

### 16.1 Couverture présente

[Vérifié] Quatre fichiers Vitest contiennent 35 cas :

- tests/challenge.test.ts ;
- tests/identifiant.test.ts ;
- tests/sabbath.test.ts ;
- tests/streak.test.ts.

Ils couvrent le calcul des jours/progrès de défis, la validation et la génération d’identifiants, le mode Sabbath et le calcul des séries. Les 35 cas passent. Ils ne couvrent ni flux/recommandation, ni route de traduction, ni upload vidéo.

### 16.2 Couverture absente

- aucun test d’intégration Supabase ;
- aucun test de politiques RLS ;
- aucun test Storage ;
- aucun test Auth/session/récupération ;
- aucun test de Server Actions réelles ;
- aucun test E2E navigateur ;
- aucun test accessibilité ;
- aucun test visuel ;
- aucun test de migration depuis zéro ;
- aucun test vidéo avec fichiers réels et erreurs réseau ;
- aucun test de modération, rôle ou anonymat ;
- aucun test de charge réellement exécuté dans cet audit.

### 16.3 Priorités de test

1. Tests SQL/RLS exploitant les trois P0.
2. Test de reconstruction du schéma de 0001 à la dernière migration.
3. Tests intégration upload → traitement → publication → masquage → suppression.
4. E2E inscription, login, upload, flux, report et modération.
5. Tests d’idempotence et de nettoyage après erreur.
6. Tests accessibilité clavier/axe/VoiceOver ciblés.
7. Tests de charge sur environnement dédié avec données synthétiques.

## 17. CI/CD et déploiement

### 17.1 État

[Vérifié] Aucun workflow .github, Dockerfile, compose, vercel.json ou pipeline de migration n’est versionné. Le guide mentionne Vercel/Supabase et l’application manuelle de SQL.

Le guide de déploiement demande seulement la migration 0001 alors que le code dépend du schéma jusqu’à 0008. Cette procédure ne reconstruit donc pas l’état attendu.

### 17.2 Build

Le build local sans réseau échoue parce que next/font tente de récupérer Geist et Playfair depuis fonts.googleapis.com. Cela révèle un build non hermétique. La correction recommandée est de versionner légalement les polices locales ou de fournir des fontes système de repli, puis de tester avec réseau explicitement bloqué.

### 17.3 Pipeline minimal proposé

À chaque pull request :

1. installation figée ;
2. génération des types Next et Supabase ;
3. lint sans warning nouveau ;
4. typecheck ;
5. tests unitaires ;
6. création Supabase éphémère et application intégrale des migrations ;
7. tests RLS/intégration ;
8. build sans réseau ;
9. E2E et accessibilité ;
10. scan secrets, dépendances, licences et migrations.

Pour déployer :

- promotion explicite dev → staging → production ;
- migrations contrôlées avec sauvegarde, répétition et plan de retour ;
- preuve de smoke test après déploiement ;
- aucune clé ou mot de passe en argument de script ;
- approbation humaine pour production.

## 18. Observabilité, exploitation, sauvegarde et reprise

### 18.1 État

[Vérifié] Aucun SDK de monitoring, logs structurés, traçage, analytics, métriques métier, endpoint santé, runbook d’incident, alerte, sauvegarde testée ou plan de reprise n’est présent dans le dépôt.

Les consoles Supabase/Vercel peuvent fournir des journaux hors dépôt, mais leur configuration et leur rétention n’ont pas été vérifiées.

### 18.2 Socle minimal

- identifiant de corrélation par requête/action/job ;
- logs structurés sans texte de prière, contenu vidéo ni secret ;
- suivi erreurs frontend/backend/worker ;
- métriques Auth, upload, publication, lecture, modération et traduction ;
- alertes sur taux d’erreur, latence, stockage, egress et consommation fournisseur ;
- journal d’audit des rôles et décisions de modération ;
- sauvegardes chiffrées et restauration testée ;
- objectifs RPO/RTO documentés ;
- procédure incident sécurité/confidentialité ;
- tableau de bord coût par utilisateur/vidéo.

## 19. Documentation

### 19.1 État des documents

- README.md est encore le modèle Create Next App et pointe vers app/page.tsx au lieu de src/app/page.tsx.
- docs/DECISIONS.md indique Server Components/Actions sans état client, alors que 13 modules use client existent.
- docs/ROADMAP.md classe encore la vidéo en phase ultérieure alors qu’un MVP vidéo est partiellement livré.
- docs/DEPLOIEMENT.md ne couvre que la migration 0001.
- docs/MULTILINGUE.md décrit locale et video_translations absents des migrations versionnées.
- docs/VALIDATION*.md décrit des instantanés historiques de 14 ou 25 tests dans deux ou trois fichiers, contre 35 tests dans quatre fichiers aujourd’hui.
- docs/FOND-AMBIANCE.md mentionne une dérive de fond, sans règle d’animation .fond-image retrouvée.
- Les URLs de production citées sont des preuves historiques, pas une validation actuelle.

### 19.2 Documents manquants

- architecture et modèle de menace ;
- schéma de données et dictionnaire ;
- contrat API/Server Actions ;
- procédure de développement local complète ;
- migration/rollback ;
- politiques RLS et matrice d’autorisations ;
- runbooks modération, incident, sauvegarde/restauration ;
- politique de confidentialité, conditions et règles communautaires ;
- sécurité et signalement de vulnérabilité ;
- contribution et conventions ;
- registre de provenance/licences des contenus ;
- guide d’exploitation média.

## 20. Forces actuelles

1. **Positionnement distinctif** — le produit combine prière, églises, mentorat, défis et Sabbath au lieu de plaquer uniquement un thème chrétien sur un flux générique.
2. **Base technique moderne** — Next.js App Router, React, TypeScript strict et Supabase offrent une vélocité adaptée au MVP.
3. **RLS généralisée** — toutes les tables applicatives ont RLS activée, ce qui constitue une meilleure base que des contrôles exclusivement côté UI.
4. **Durcissement SQL partiel de qualité** — search_path fixé sur les fonctions security definer et droits d’exécution retirés.
5. **Interactions contraintes** — plusieurs réactions ont des clés uniques et les compteurs vidéo sont atomiques.
6. **Internationalisation structurée** — 12 langues typées et RTL, malgré la dérive de persistance.
7. **Identité visuelle cohérente** — palette, surfaces, voix éditoriale et mode Sabbath forment un ensemble reconnaissable.
8. **Accessibilité amorcée** — langue/direction, reduced-motion partiel, quelques labels et navigation clavier.
9. **Vie privée comportementale limitée par défaut** — aucun historique détaillé de visionnage ou profilage publicitaire n’est encore collecté.
10. **Tests rapides** — 35 tests unitaires passent en moins d’une seconde dans l’environnement observé.

## 21. Dette technique et produit

### 21.1 Dette de sécurité

- séparation insuffisante des champs privilégiés ;
- autorisations de page incohérentes avec les noms de rôles ;
- absence de rate limit, blocage, sanctions et audit ;
- stockage média public et modération contournable ;
- scripts de secrets non conformes aux bonnes pratiques.

### 21.2 Dette de données

- dérive code/migrations ;
- index incomplets ;
- compteurs pouvant dériver ;
- opérations concurrentes non verrouillées ;
- aucune politique de rétention ou de nettoyage Storage ;
- aucun modèle d’événements, consentements ou droits média.

### 21.3 Dette média

- original unique ;
- contrôle client seulement ;
- pas de traitement asynchrone ;
- pas de reprise/idempotence ;
- pas de captions ;
- pas de suppression/purge complète.

### 21.4 Dette produit

- fonctions sociales essentielles incomplètes ;
- modération centrée presque uniquement sur la vidéo ;
- mentorat et mineurs non cadrés ;
- absence totale de modèle SaaS/monétisation ;
- signaux artificiels de présence/notification ;
- expérience d’erreur, paramètres et onboarding incomplets.

### 21.5 Dette de livraison

- README et guides obsolètes ;
- aucun CI/CD ;
- build dépendant du réseau ;
- aucune reproduction locale Supabase complète ;
- aucune observabilité ou restauration démontrée ;
- couverture limitée aux fonctions pures.

## 22. Risques majeurs

| Risque | Probabilité | Gravité | Déclencheur | Réponse |
|---|---|---|---|---|
| Prise de rôle modérateur/admin | Élevée | Critique | simple requête authentifiée | bloquer immédiatement les colonnes privilégiées |
| Révélation d’une prière anonyme | Élevée | Critique | lecture directe de la table | vue/RPC publique sûre et accès identité restreint |
| Redistribution d’un contenu masqué | Élevée | Critique | URL conservée ou requête de base | bucket privé et autorisation cohérente |
| Abus financier de traduction | Élevée | Haute | requêtes automatisées | auth, quota, taille, cache et budget |
| Incident impliquant un mineur | Moyenne à élevée | Critique | mentorat/contact ouvert | suspendre/cadrer, block/report, procédures |
| Perte ou incohérence de médias | Élevée | Haute | erreur après upload ou retry | workflow idempotent et réconciliation |
| Coût Storage/egress incontrôlé | Moyenne | Haute | croissance des uploads/lectures | variantes, quotas, lifecycle et alertes |
| Déploiement avec schéma incomplet | Élevée | Haute | guide limité à 0001 | migration automatisée depuis zéro |
| Incapacité à restaurer | Inconnue | Haute | erreur humaine/panne fournisseur | sauvegarde et restauration exercées |
| Non-conformité confidentialité/droits | Élevée | Haute | lancement public | cadrage juridique et documents avant collecte |
| Dégradation du flux à l’échelle | Élevée | Haute | corpus et interactions croissants | curseur, candidats préagrégés, index |
| État UI mensonger | Élevée | Moyenne | erreur Supabase ignorée | contrat d’erreurs uniforme et tests |

## 23. Quick wins

Les actions ci-dessous sont de petites interventions, mais elles ne doivent commencer qu’après validation du plan.

| Priorité | Action | Effort estimé | Valeur |
|---:|---|---|---|
| 1 | Bloquer immédiatement role et les champs système dans la politique profiles | S | ferme le P0 d’élévation |
| 2 | Retirer l’auteur des lectures publiques de prières anonymes | M | ferme le P0 confidentialité |
| 3 | Passer les vidéos masquées hors accès public | M | ferme le P0 modération |
| 4 | Protéger /api/translate par session, taille, locales et quota | S | limite abus et coûts |
| 5 | Ajouter une vraie garde pasteur/moderateur côté serveur | S | corrige l’autorisation |
| 6 | Interdire les messages dans une salle fermée au niveau RLS | S | ferme un contournement |
| 7 | Corriger locale/lang et versionner video_translations | M | rend l’environnement reproductible |
| 8 | Supprimer les faux compteurs de salles et la fausse pastille | S | restaure la confiance |
| 9 | Utiliser des polices locales et construire sans réseau | S | rend le build hermétique |
| 10 | Rendre toutes les erreurs Supabase explicites | M | évite les faux succès |
| 11 | Ajouter labels, aria-live et dialogue accessible | M | gain accessibilité rapide |
| 12 | Ajouter tri stable et curseur au flux | M | réduit doublons/omissions |
| 13 | Documenter toutes les migrations et un setup propre | S | évite les déploiements incomplets |
| 14 | Retirer mots de passe CLI et inspection ps axeww | S | améliore l’hygiène des secrets |
| 15 | Ajouter CI lint/typecheck/test/build | M | empêche les régressions immédiates |

Échelle : S = 0,5 à 2 jours, M = 3 à 5 jours, L = 1 à 2 semaines, XL = 2 à 4 semaines. Ce sont des ordres de grandeur à revalider après décisions produit et infrastructure.

## 24. Plan de refonte proposé — lots 0 à 9

Le plan reste volontairement progressif. Aucun lot ne doit être considéré comme autorisé par ce rapport.

### Lot 0 — Garde-fous et reproductibilité

- **Objectif** : rendre l’état courant reproductible et empêcher une régression silencieuse.
- **Fichiers concernés** : package.json, next.config.ts, src/app/layout.tsx, .env.example, README.md, docs/DEPLOIEMENT.md ; nouveaux fichiers proposés .github/workflows/ci.yml, supabase/config.toml et docs/ARCHITECTURE.md.
- **Modifications exactes proposées** :
  - fixer une plage Node via engines ;
  - remplacer les polices téléchargées au build par des fichiers locaux ou fontes système ;
  - versionner le démarrage Supabase local et l’application de 0001 à 0008 ;
  - ajouter génération des types Next/Supabase ;
  - créer une CI hors secrets : install, lint, typecheck, test, migration depuis zéro, build sans réseau ;
  - mettre le README en conformité avec src/app et pnpm.
- **Dépendances** : aucune décision produit ; accès CI/Supabase local lors de l’implémentation.
- **Migrations** : aucune migration métier ; validation intégrale de l’historique existant.
- **Tests à ajouter** : smoke migration from zero, script de détection de dérive du schéma, build réseau bloqué.
- **Acceptation binaire** :
  - un clone propre s’installe avec le lockfile ;
  - les huit migrations s’appliquent sans intervention manuelle ;
  - lint, typecheck, 35 tests et build passent hors réseau ;
  - le workflow échoue si une étape échoue.
- **Effort** : M, 3 à 5 jours.
- **Risque/ordre** : faible ; premier lot, nécessaire à tous les suivants.

### Lot 1 — P0/P1 sécurité, autorisations et contrat de données

- **Objectif** : fermer les trois P0 et les contournements d’autorisation immédiats.
- **Fichiers concernés** : supabase/migrations/0001_selah_core.sql à supabase/migrations/0008_selah_feed_social.sql comme références non réécrites ; nouvelle migration proposée supabase/migrations/0009_security_and_schema_contract.sql ; src/app/actions.ts ; src/app/(app)/prayer/page.tsx ; src/app/(app)/pastor/page.tsx ; src/app/(app)/moderation/page.tsx ; src/app/api/translate/route.ts ; src/proxy.ts ; next.config.ts.
- **Modifications exactes proposées** :
  - politique profiles limitant l’utilisateur aux champs non privilégiés ; mutations de rôle réservées à une RPC administrative journalisée ;
  - vue/RPC de prière ne révélant jamais author_id pour une prière anonyme ;
  - filtrage RLS de videos.hidden et migration du bucket vers privé ;
  - garde pasteur/moderateur/admin exécutée côté serveur ;
  - messages interdits si prayer_rooms.closed_at n’est pas null ;
  - INSERT vidéo limité aux champs auteur légitimes, valeurs système calculées ;
  - aligner profiles.lang/locale et créer video_translations avec ses politiques ;
  - route traduction authentifiée, taille maximale, locales autorisées, timeout, quota et journal métrique sans contenu ;
  - en-têtes de sécurité versionnés ;
  - supprimer les erreurs brutes d’auth des URLs.
- **Dépendances** : choix du mécanisme de rate limit ; fenêtre de migration Storage ; définition des rôles.
- **Migrations** : 0009_security_and_schema_contract.sql, idempotente et accompagnée d’un plan de retour.
- **Tests à ajouter** :
  - matrice RLS anon/authenticated/membre/leader/pasteur/moderateur/admin ;
  - exploit d’auto-élévation attendu refusé ;
  - lecture anonyme sans identité ;
  - média hidden inaccessible ;
  - salle fermée non écrivable ;
  - traduction 401/413/429 et succès borné.
- **Acceptation binaire** :
  - les trois scénarios P0 échouent avec preuve automatisée ;
  - aucune page privilégiée ne repose seulement sur l’UI ;
  - une recréation du schéma fournit exactement les colonnes/tables consommées ;
  - aucune régression sur les 35 tests existants.
- **Effort** : XL, 8 à 12 jours.
- **Risque/ordre** : élevé mais bloquant ; immédiatement après Lot 0, avant toute bêta.

### Lot 2 — Pipeline média fiable

- **Objectif** : passer d’un upload public direct à un cycle média privé, validé, idempotent et distribuable.
- **Fichiers concernés** : src/app/(app)/videos/upload-form.tsx, src/app/(app)/videos/depot-lot.tsx et src/app/vertical-feed.tsx ; nouveaux modules proposés src/lib/media/contracts.ts, src/lib/media/validation.ts, src/app/api/videos/uploads/route.ts, src/app/api/videos/uploads/[uploadId]/complete/route.ts, workers/media/processor.ts ; nouvelle migration supabase/migrations/0010_media_pipeline.sql.
- **Modifications exactes proposées** :
  - état media_assets/media_jobs avec checksum, propriétaire, statut et clé idempotente ;
  - zone temporaire privée et URL signée ;
  - upload reprenable avec progression, annulation et reprise ;
  - validation serveur magic bytes, taille, durée, dimensions, codec et pistes ;
  - antivirus et suppression des métadonnées selon les risques ;
  - transcodage portrait multi-bitrate, HLS, miniature et piste de sous-titres ;
  - publication atomique seulement après succès ;
  - retries bornés, dead-letter, réconciliation et purge d’orphelins ;
  - suppression auteur qui purge variantes selon rétention.
- **Dépendances** : choix du fournisseur vidéo/worker/queue, CDN et limites tarifaires ; validation des codecs/licences.
- **Migrations** : 0010_media_pipeline.sql pour assets, renditions, jobs, captions et états ; migration des vidéos existantes préparée séparément.
- **Tests à ajouter** : fichiers valides/invalides, MIME trompeur, checksum duplicate, reprise, panne DB après upload, retry idempotent, purge, vidéo masquée, captions.
- **Acceptation binaire** :
  - aucun original n’est publiquement lisible ;
  - un même upload idempotent ne crée qu’un asset ;
  - une panne n’abandonne aucun objet au-delà de la fenêtre de réconciliation ;
  - le lecteur reçoit au moins deux bitrates et une miniature ;
  - chaque vidéo peut porter une piste de sous-titres.
- **Effort** : XL, 3 à 5 semaines selon fournisseur.
- **Risque/ordre** : élevé ; après Lot 1, avant croissance d’usage vidéo.

### Lot 3 — Modération, mineurs et confiance

- **Objectif** : rendre les interactions communautaires gouvernables et sûres.
- **Fichiers concernés** : src/app/(app)/moderation/page.tsx, src/app/(app)/mentorship/page.tsx, src/app/(app)/rooms/[id]/page.tsx, src/app/vertical-feed.tsx, src/app/actions.ts ; nouvelles pages proposées src/app/(app)/safety/* et src/app/(app)/appeals/* ; migration supabase/migrations/0011_trust_and_safety.sql ; nouveaux docs/RULES_COMMUNITY.md et docs/MODERATION_RUNBOOK.md.
- **Modifications exactes proposées** :
  - modèle case/report/evidence/decision/sanction/appeal ;
  - taxonomie, gravité, assignation, SLA et journal append-only ;
  - block, mute et report sur profil, post, commentaire, vidéo et message ;
  - suspension/strike/restriction d’upload et appel ;
  - conservation probante distincte du contenu visible ;
  - procédure danger immédiat et exploitation de mineurs ;
  - fermeture ou refonte du mentorat selon âge, vérification et supervision ;
  - anti-spam et limites de cadence.
- **Dépendances** : décisions d’âge, territoires, équipe de modération, horaires/SLA et conseil juridique.
- **Migrations** : 0011_trust_and_safety.sql ; backfill des reports existants ; politique de rétention explicite.
- **Tests à ajouter** : permissions par rôle, blocage bidirectionnel, contenu masqué, sanctions, appel, preuve conservée, limites de cadence, scénarios mineurs.
- **Acceptation binaire** :
  - chaque surface interactive permet blocage et signalement ;
  - chaque décision est attribuée, horodatée et auditable ;
  - le contenu masqué est inaccessible ;
  - un utilisateur sanctionné ne contourne pas la restriction via API directe ;
  - le mentorat respecte le modèle de sécurité validé.
- **Effort** : XL, 3 à 5 semaines.
- **Risque/ordre** : très élevé ; parallèle partiel avec Lot 2 après Lot 1.

### Lot 4 — Social utile et contrôlable

- **Objectif** : compléter les fondamentaux sociaux sans maximiser l’addiction.
- **Fichiers concernés** : src/app/(app)/videos/page.tsx, src/app/(app)/feed/page.tsx, src/app/vertical-feed.tsx, src/app/actions.ts ; nouvelles routes proposées src/app/(app)/following/page.tsx, src/app/(app)/saved/page.tsx, src/app/(app)/profile/[username]/page.tsx ; migration supabase/migrations/0012_social_controls.sql.
- **Modifications exactes proposées** :
  - flux Abonnements chronologique ;
  - favoris et historique optionnel à rétention courte ;
  - Pas intéressé, masquer auteur, block/mute ;
  - profils publics et réglages de visibilité ;
  - recherche de profils/contenus avec filtres sûrs ;
  - pagination curseur des commentaires/posts ;
  - supprimer toute audience ou notification fictive.
- **Dépendances** : politique de confidentialité et décision sur historique/recommandation.
- **Migrations** : bookmarks, content_preferences, blocks, mutes et index ; aucune collecte implicite avant consentement approprié.
- **Tests à ajouter** : visibilité, blocage, pagination, recherche, suppression, rétention, interactions concurrentes.
- **Acceptation binaire** :
  - Follows alimente un flux réel ;
  - un blocage retire réciproquement les contenus/interactions prévus ;
  - aucune preuve sociale n’est simulée ;
  - toutes les listes importantes sont paginées.
- **Effort** : L, 2 à 3 semaines.
- **Risque/ordre** : moyen ; après Lot 1, coordonné avec Lots 3 et 5.

### Lot 5 — Recommandation explicable

- **Objectif** : obtenir un flux stable, diversifié, contrôlable et mesurable.
- **Fichiers concernés** : supabase/migrations/0008_selah_feed_social.sql comme référence ; nouvelle migration supabase/migrations/0013_feed_candidates_and_events.sql ; nouveaux modules src/lib/feed/candidates.ts, src/lib/feed/ranking.ts, src/lib/feed/safety.ts ; src/app/vertical-feed.tsx.
- **Modifications exactes proposées** :
  - curseur immuable score_bucket/created_at/id ;
  - candidats séparés pour récent, abonnements et découverte ;
  - plafonds d’auteur, diversité langue/catégorie et filtre sécurité avant classement ;
  - événements minimaux avec rétention ;
  - score documenté et versionné ;
  - expérimentation avec garde-fous, jamais sur données religieuses sensibles ;
  - tableau de bord exposition/qualité/diversité.
- **Dépendances** : métriques de succès produit, Lot 3 pour le filtre sécurité, décision de consentement/analytics.
- **Migrations** : feed_events, candidate_sets, content_preferences et versions de score ; vues/index adaptés.
- **Tests à ajouter** : déterminisme, curseur sans doublon, diversité, nouveaux auteurs, contenu bloqué/masqué, résistance aux compteurs injectés, propriété des métriques.
- **Acceptation binaire** :
  - aucune duplication/omission dans un jeu de données concurrent ;
  - Abonnements et Récent restent disponibles ;
  - le classement est explicable par version ;
  - un contenu bloqué ou masqué n’entre jamais dans les candidats ;
  - la rétention des événements est automatisée.
- **Effort** : L à XL, 2 à 4 semaines.
- **Risque/ordre** : moyen/élevé ; après Lots 1 et 3, incrémental.

### Lot 6 — UX, accessibilité et design original

- **Objectif** : rendre tous les parcours essentiels utilisables au clavier, lecteur d’écran et réseau contraint, avec une identité propre.
- **Fichiers concernés** : src/app/globals.css, src/app/layout.tsx, src/app/nav-components.tsx, src/app/vertical-feed.tsx, src/app/(app)/videos/* et les formulaires Auth/prière/mentorat ; nouvelles pages proposées src/app/(app)/settings/page.tsx et src/app/(app)/onboarding/page.tsx.
- **Modifications exactes proposées** :
  - labels, descriptions d’erreur et focus systématiques ;
  - dialogue accessible pour les commentaires ;
  - lecteur clavier avec boutons explicites, pause et préférence autoplay ;
  - captions/transcript ;
  - cibles 44 px, aria-current, aria-live ;
  - reduced-motion complet et mode économie de données ;
  - onboarding et paramètres cohérents ;
  - tokens de design, vocabulaire de mouvement Selah et suppression des références imitatives dans les commentaires.
- **Dépendances** : Lot 2 pour les captions, décisions onboarding/confidentialité.
- **Migrations** : préférences accessibilité/autoplay seulement si synchronisation multi-appareil retenue ; sinon stockage local.
- **Tests à ajouter** : axe, clavier, focus, VoiceOver, zoom, contraste, reduced-motion, save-data, captures mobiles.
- **Acceptation binaire** :
  - aucun blocage critique axe sur les pages principales ;
  - tous les contrôles vidéo fonctionnent sans pointeur ;
  - chaque vidéo publiée dispose d’un chemin captions ou d’une exception explicite ;
  - toutes les cibles principales atteignent 44×44 CSS px ;
  - autoplay et mouvement respectent les préférences.
- **Effort** : L, 2 à 3 semaines.
- **Risque/ordre** : moyen ; démarrage après Lot 1, finalisation avec Lot 2.

### Lot 7 — Modèle économique et entitlements

- **Objectif** : n’implémenter que le modèle commercial validé, avec droits et comptabilité cohérents.
- **Fichiers concernés** : aucun fichier actuel ne couvre ce domaine ; nouveaux modules proposés src/lib/billing/*, src/app/api/billing/webhook/route.ts, src/app/(app)/settings/billing/page.tsx, supabase/migrations/0014_billing_and_entitlements.sql et docs/BILLING_MODEL.md.
- **Modifications exactes proposées** :
  - formaliser plans, quotas, organisations, essais et entitlements ;
  - sélectionner un prestataire selon territoires, fiscalité et dons ;
  - webhooks signés, idempotents et rejouables ;
  - factures/remboursements/annulations ;
  - séparation donation, abonnement et rémunération ;
  - aucune publicité comportementale fondée sur données religieuses.
- **Dépendances** : décision B2C/B2B/dons, pays, fiscalité, conseil juridique, fournisseur et politique de remboursement.
- **Migrations** : 0014 seulement après décision ; customers, subscriptions, entitlements, webhook_events et ledger minimal.
- **Tests à ajouter** : signature, idempotence, ordre d’événements, double webhook, remboursement, expiration, quotas, panne fournisseur.
- **Acceptation binaire** :
  - aucun droit payant ne dépend seulement du client ;
  - tout webhook peut être rejoué sans double effet ;
  - les états facture/abonnement/entitlement convergent ;
  - les textes juridiques et prix sont validés pour les territoires.
- **Effort** : XL, 3 à 6 semaines après décisions.
- **Risque/ordre** : élevé ; ne pas lancer avant Lots 1 et 3 ni avant arbitrage juridique.

### Lot 8 — Performance, observabilité et résilience

- **Objectif** : mesurer, budgéter, alerter et restaurer.
- **Fichiers concernés** : next.config.ts, src/lib/supabase/* et k6/* ; nouveaux src/lib/observability/*, src/app/api/health/route.ts, supabase/migrations/0015_indexes_retention_and_audit.sql, docs/OBSERVABILITY.md, docs/BACKUP_RESTORE.md, docs/INCIDENT_RESPONSE.md.
- **Modifications exactes proposées** :
  - logs structurés avec redaction ;
  - erreurs, traces et métriques ;
  - health/readiness sans fuite ;
  - index confirmés par EXPLAIN ANALYZE ;
  - purge/rétention et alertes Storage/egress ;
  - budgets Web Vitals et bundle ;
  - sauvegarde/restauration et exercice ;
  - scénarios k6 paramétrés sans URL de production en dur.
- **Dépendances** : choix de télémétrie souveraine/compatible confidentialité, environnement de charge dédié, objectifs RPO/RTO.
- **Migrations** : index et jobs de rétention ; table audit si non livrée au Lot 3.
- **Tests à ajouter** : redaction, alerte synthétique, restauration, EXPLAIN, k6 smoke/load/stress sur staging isolé, budget bundle.
- **Acceptation binaire** :
  - erreurs critiques déclenchent une alerte testée ;
  - aucune donnée sensible n’apparaît dans les logs ;
  - une restauration est chronométrée et documentée ;
  - les seuils k6 validés sont atteints sur staging ;
  - coûts Storage/egress/traduction sont visibles.
- **Effort** : L à XL, 2 à 4 semaines.
- **Risque/ordre** : moyen ; instrumentation dès Lot 1, consolidation après Lots 2 et 5.

### Lot 9 — Documentation, conformité et livraison

- **Objectif** : rendre le produit exploitable et auditable par une équipe autre que ses auteurs.
- **Fichiers concernés** : README.md, docs/*, nouveaux SECURITY.md, CONTRIBUTING.md, docs/DATA_MAP.md, docs/RLS_MATRIX.md, docs/MEDIA_RIGHTS.md, docs/RELEASE.md, et documents juridiques validés.
- **Modifications exactes proposées** :
  - synchroniser architecture, routes, migrations, tests et déploiement ;
  - documenter matrice des rôles/RLS et modèle de menace ;
  - publier procédures incident, modération, sauvegarde et release ;
  - tenir registre de provenance/licences des assets ;
  - intégrer politique de confidentialité, conditions et règles communautaires validées ;
  - ajouter une checklist de lancement et un journal de décisions.
- **Dépendances** : résultats de tous les lots, validation juridique et opérationnelle.
- **Migrations** : aucune nouvelle par principe ; documentation de toutes les migrations et retours.
- **Tests à ajouter** : liens/doc lint, exemples exécutables, test de setup par une machine propre, vérification automatique routes/schema.
- **Acceptation binaire** :
  - un tiers installe et teste sans information orale ;
  - chaque permission est documentée et testée ;
  - chaque asset possède une provenance/licence ;
  - les procédures incident/restauration/modération ont un propriétaire ;
  - la checklist de lancement ne comporte aucun P0/P1 ouvert accepté sans décision formelle.
- **Effort** : L, 1 à 3 semaines cumulées.
- **Risque/ordre** : faible techniquement, critique opérationnellement ; mise à jour continue, clôture en dernier.

## 25. Matrice de découverte et priorisation

| ID | Nature | Domaine | Constat | Preuve principale | Sévérité | Impact | Recommandation | Effort | Risque régression |
|---|---|---|---|---|---|---|---|---|---|
| F-001 | [Vérifié] | Autorisation | Un membre peut modifier son rôle | 0001_selah_core.sql:15,28-29 ; actions.ts:361-394 | P0 | Contrôle modération/admin | Colonnes privilégiées non modifiables + RPC auditée | M | Moyen |
| F-002 | [Vérifié] | Confidentialité | Une prière anonyme révèle author_id aux authentifiés | 0001_selah_core.sql:91-106 ; src/app/(app)/prayer/page.tsx:6-10 | P0 | Révélation de données sensibles | Vue/RPC publique sans identité | M | Moyen |
| F-003 | [Vérifié] | Média/modération | Une vidéo hidden reste dans la table et le bucket public | 0004_selah_phase2.sql:17-22 ; 0005_selah_bucket_videos.sql:4-13 | P0 | Contenu interdit redistribuable | Bucket privé + RLS + URLs signées | L | Élevé |
| F-004 | [Vérifié] | Données/feed | INSERT vidéo accepte des champs système | politiques videos de 0004 | P1 | Manipulation du rang/intégrité | Colonne whitelist/RPC de publication | M | Moyen |
| F-005 | [Vérifié] | Pipeline média | Type et média validés seulement côté client | src/app/(app)/videos/upload-form.tsx:24-29,199-224 | P1 | Fichier hostile, fuite métadonnées, coût | Validation serveur et quarantaine | XL | Élevé |
| F-006 | [Vérifié] | API/coûts | POST /api/translate est public et non borné | api/translate/route.ts ; proxy.ts | P1 | Abus de quota et transfert de texte | Auth, taille, allowlist, quota, timeout | S | Faible |
| F-007 | [Vérifié] + [Choix stratégique] | Mineurs/mentorat | Aucun âge, vérification mentor ou protection de contact | mentorship et schéma 0003 | P1 | Grooming, atteinte aux personnes | Suspendre/cadrer, vérifier, block/report | XL | Élevé |
| F-008 | [Vérifié] | Modération | Signalements sans dossier, sanction, appel ou preuve durable | reports et /moderation | P1 | Décisions impossibles à auditer | Modèle Trust & Safety complet | XL | Moyen |
| F-009 | [Vérifié] | Salles | Une salle fermée reste écrivable | politiques room_messages ; RoomLive rendu | P1 | Spam/abus hors contrôle | Vérifier prayer_rooms.closed_at dans RLS/action | S | Faible |
| F-010 | [Vérifié] | Autorisation | /pastor ne contrôle pas le rôle lu | src/app/(app)/pastor/page.tsx:13-17 | P1 | Données d’église exposées | Garde serveur et politiques dédiées | S | Faible |
| F-011 | [Vérifié] | Schéma/i18n | locale/video_translations consommés mais non versionnés | actions.ts:63-79 ; migrations 0001-0008 | P1 | Déploiement neuf incohérent | Migration de contrat + types générés | M | Moyen |
| F-012 | [Vérifié] | Storage | Échecs/retries laissent des objets orphelins | upload-form.tsx et depot-lot.tsx | P1 | Fuite, coût, incohérence | Workflow idempotent et réconciliation | L | Moyen |
| F-013 | [Vérifié] + [Choix stratégique] | Juridique/privacy | Aucun socle confidentialité, rétention, droits ou DSAR | absence dans dépôt/docs | P1 | Non-conformité et perte de confiance | Cadrage professionnel + fonctions produit | XL | Élevé |
| F-014 | [Vérifié] | Secrets/outils | Clé recherchée via ps axeww et mot de passe CLI accepté | scripts/doublage/generer-voix.py:37-47 ; scripts de publication | P1 | Secret dans processus/historique | Trousseau/descripteur et suppression options | S | Faible |
| F-015 | [Vérifié] | Build/CI | Build télécharge Google Fonts et aucune CI n’existe | layout.tsx ; absence .github | P1 | Livraison non reproductible | Polices locales + CI sans réseau | M | Faible |
| F-016 | [Vérifié] | Exploitation | Aucun monitoring, PRA ou restauration testée | absence de config/runbooks | P1 | Panne ou perte indétectable | Observabilité et exercice restore | L | Moyen |
| F-017 | [Vérifié] | Anti-abus | Aucun quota/rate limit transversal | routes/actions/policies | P1 | Spam, DoS, coûts | Limiteurs par acteur/IP/ressource | L | Moyen |
| F-018 | [Vérifié] | Recommandation | Score mouvant + offset + vue globale | 0008 et vertical-feed | P1 | Doublons, omissions, coût, manipulation | Curseur, score sûr, candidats | L | Moyen |
| F-019 | [Vérifié] | Base/performance | Index manquants sur plusieurs FK et files | migrations 0001-0008 | P2 | Latence croissante | Index après EXPLAIN ANALYZE | M | Faible |
| F-020 | [Vérifié] | Intégrité | Compteur commentaire dérive et streak peut courir | triggers bump_comment/touch_streak | P2 | Statistiques fausses | Triggers symétriques/verrou/transaction | M | Moyen |
| F-021 | [Vérifié] | Mentorat | upsert mentor_offers sans policy UPDATE | action et policies 0003 | P2 | Mise à jour silencieusement échouée | Ajouter policy ou remplacer le flux | S | Faible |
| F-022 | [Vérifié] | Confiance | Audience de salle et notification sont fictives | src/app/(app)/rooms/page.tsx:39-48,121-124 | P2 | Tromperie perçue | Supprimer ou connecter à une donnée réelle | S | Faible |
| F-023 | [Vérifié] | Accessibilité | Labels, dialogue, focus, captions et live region incomplets | formulaires et vertical-feed | P2 | Exclusion d’utilisateurs | Correctifs WCAG 2.2 AA | L | Moyen |
| F-024 | [Vérifié] | Performance média | Original direct, autoplay et possible double vidéo d’accueil | vertical-feed, landing, public assets | P2 | Bande passante et lenteur | Variantes, data saver, rendu conditionnel | L | Moyen |
| F-025 | [Vérifié] | Code | Gros composants, duplication et erreurs avalées | vertical-feed/actions/upload | P2 | Régression et diagnostic difficiles | Découpage domaine + Result uniforme | L | Moyen |
| F-026 | [Vérifié] | Documentation | README, roadmap, déploiement et i18n divergent | README.md ; docs/* | P2 | Setup/déploiement erronés | Réécrire depuis l’état vérifié | M | Faible |
| F-027 | [Vérifié] | Tests | Aucun RLS, intégration, E2E, accessibilité ou média réel | tests/* et absence configs | P2 | Failles non détectées | Pyramide de tests critique | L | Faible |
| F-028 | [Vérifié] | I18n | Chaînes françaises résiduelles et pays incomplets | batch upload, Sabbath, liste pays | P2 | Expérience incohérente | Extraire toutes les chaînes et source ISO | M | Faible |
| F-029 | [Vérifié] | Auth produit | Pas de reset, MFA, sessions, export ou suppression | routes Auth/actions | P2 | Support et sécurité insuffisants | Cycle de compte complet | L | Moyen |
| F-030 | [Vérifié] | Social | Follow existe sans flux dédié ni contrôles négatifs | follows et /videos | P2 | Valeur sociale limitée | Abonnements, block/mute/not interested | L | Moyen |
| F-031 | [Vérifié] | PWA | Cache/service worker basiques, stratégie offline limitée | manifest et service worker | P2 | Hors-ligne imprévisible | Politique de cache/version/purge | M | Moyen |
| F-032 | [Vérifié] | Vidéo produit | Durées incohérentes, pas de drafts/schedule/delete | upload UI, DB et scripts | P2 | Échecs créateur et dette Storage | Contrat unique et cycle de publication | L | Moyen |
| F-033 | [Vérifié] | Qualité | Trois warnings ESLint dans les scripts k6 | sortie pnpm lint | P3 | Dette mineure | Nommer les exports par défaut | S | Faible |
| F-034 | [Hypothèse à confirmer] | Design/accessibilité | Contraste et reduced-motion non validés en navigateur | docs historiques, CSS | P3 | Défauts visuels possibles | Audit navigateur et appareils réels | M | Faible |
| F-035 | [Vérifié] | Entretien | view_count et certaines actions restent inutilisés | schéma/actions et usages rg | P3 | Confusion et surface morte | Raccorder, documenter ou retirer après preuve | S | Faible |

### 25.1 Ordre recommandé

1. F-001 à F-003 avant toute bêta.
2. F-004 à F-011 avant ouverture à des utilisateurs non contrôlés.
3. F-012 à F-018 avant croissance, monétisation ou promotion publique.
4. F-019 à F-032 pendant la consolidation produit.
5. F-033 à F-035 dans l’entretien continu.

## 26. Commandes exécutées, résultats et reproductibilité

Toutes les commandes ci-dessous ont été exécutées dans /Users/mskolosalgmail.com/Developer/TIKTOK_CRETIEN/selah, sauf la recherche initiale du dépôt. Aucune commande de mutation distante n’a été lancée.

### 26.1 État Git et inventaire

| Commande | Code | Sortie réelle utile |
|---|---:|---|
| git status --short | 0 | aucune ligne avant création du rapport |
| git branch --show-current | 0 | selah-mvp |
| git rev-parse --short HEAD | 0 | 1704e8a |
| git diff --name-only | 0 | aucune ligne : aucun fichier suivi modifié |
| git diff --cached --name-only | 0 | aucune ligne : aucun changement indexé |
| git ls-files --others --exclude-standard | 0 | AUDIT_SAAS_VIDEO_CHRETIEN.md uniquement |
| git status --short après création du rapport | 0 | ?? AUDIT_SAAS_VIDEO_CHRETIEN.md |
| git ls-files \| wc -l | 0 | 144 |
| find src/app -type f -name page.tsx \| wc -l | 0 | 17 |
| find src/app -type f -name route.ts \| wc -l | 0 | 1 |
| rg -n "^export async function " src/app/actions.ts \| wc -l | 0 | 28 |
| rg -i "^create table " supabase/migrations/*.sql \| wc -l | 0 | 19 |
| rg -io --no-filename "^create (or replace )?view public\\.[a-z_]+" supabase/migrations/*.sql \| awk '{print $NF}' \| sort -u | 0 | public.church_pulse, public.intercession_map, public.videos_feed |
| rg -i "^create (unique )?index " supabase/migrations/*.sql \| wc -l | 0 | 7 |
| find tests -type f -name "*.test.ts" \| wc -l | 0 | 4 |

### 26.2 Dépendances

Commandes et résultats, codes 0 :

    node --version
    v24.13.0

    pnpm --version
    11.20.0

Commande :

    pnpm list --depth 0

Résultat utile, code 0 :

    next 16.3.0
    react 19.2.8
    react-dom 19.2.8
    @supabase/ssr 0.12.4
    @supabase/supabase-js 2.112.1
    lucide-react 1.29.0
    tailwindcss 4.3.3
    typescript 5.9.3
    eslint 9.39.5
    vitest 4.1.10

Commande :

    pnpm install --frozen-lockfile --offline

Résultat, code 0 :

    Already up to date
    Done in 131ms using pnpm v11.20.0

Cette validation prouve la résolution hors ligne du lockfile présent ; elle ne constitue pas un audit de vulnérabilités.

### 26.3 Lint

Commande :

    pnpm lint

Résultat, code 0 : zéro erreur et trois warnings.

    k6/load.js:20    import/no-anonymous-default-export
    k6/smoke.js:17   import/no-anonymous-default-export
    k6/stress.js:21  import/no-anonymous-default-export

### 26.4 Typecheck

Première commande :

    pnpm exec tsc --noEmit --incremental false

Premier résultat, code 2 :

    src/app/layout.tsx(32,56): error TS2304: Cannot find name 'LayoutProps'.

Le type est généré par Next.js. La documentation Next embarquée dans node_modules a été consultée, puis la génération officielle a été exécutée :

    NEXT_TELEMETRY_DISABLED=1 pnpm exec next typegen

Résultat, code 0 :

    Generating route types...
    ✓ Types generated successfully

Nouvelle exécution :

    pnpm exec tsc --noEmit --incremental false

Résultat, code 0 : aucune sortie, donc aucune erreur TypeScript. Aucun fichier source n’a été modifié ; les artefacts générés sont ignorés par Git.

### 26.5 Tests unitaires

Commande :

    pnpm test

Résultat, code 0 :

    Test Files  4 passed (4)
    Tests       35 passed (35)
    Duration    91ms

Vitest a aussi émis un avertissement : vitest.config.ts utilise une syntaxe ESM chargée comme CommonJS, qui ne sera plus supportée par un futur configLoader:native. La correction future consiste à utiliser une extension/configuration ESM explicite.

### 26.6 Build

Commande exécutée avec accès réseau explicitement refusé :

    sandbox-exec -p "(version 1) (allow default) (deny network*)" env NEXT_TELEMETRY_DISABLED=1 pnpm build

Résultat, code 1 :

    Failed to compile.
    next/font: error:
    Failed to fetch Geist from Google Fonts.
    Failed to fetch Playfair Display from Google Fonts.
    getaddrinfo ENOTFOUND fonts.googleapis.com

Verdict : build non validé. Il n’a pas été relancé avec réseau, conformément au périmètre sans contact externe. La correction attendue est le remplacement des polices distantes par des assets locaux/licenciés, puis une nouvelle validation hors ligne.

### 26.7 Scénarios de charge

Commandes :

    k6 inspect k6/smoke.js
    k6 inspect k6/load.js
    k6 inspect k6/stress.js

Résultat : les trois inspections se terminent avec le code 0.

| Scénario | Charge déclarée | Durée | Seuils |
|---|---|---|---|
| smoke | 5 VU | 30 s | échecs < 1 %, p95 < 800 ms |
| load | 50 → 200 → 0 VU | 5 min | échecs < 2 %, p95 < 1500 ms |
| stress | 200 → 500 → 1000 → 0 VU | 6 min | échecs < 5 % |

Ces scripts n’ont pas été exécutés contre une cible : aucun serveur local qualifié n’était démarré et le périmètre interdisait de contacter la production.

### 26.8 Contrôles des assets média

Commandes :

    find public -type f -exec stat -f '%z' {} \; | awk '{s+=$1} END {printf "%d bytes, %.2f MiB\n", s, s/1048576}'
    find public/fonds -type f -exec stat -f '%z' {} \; | awk '{s+=$1} END {printf "%d bytes, %.1f KiB\n", s, s/1024}'
    for f in public/landing/hero-large.mp4 public/landing/hero-vertical.mp4 public/sons/ambiance-selah.m4a; do ffprobe -v error -show_entries format=duration,size -show_entries stream=codec_name,width,height -of compact=p=0:nk=0 "$f"; done

Résultats, codes 0 :

    6402452 bytes, 6.11 MiB
    598026 bytes, 584.0 KiB
    hero-large.mp4: h264 1280x720, aac, 10.005000 s, 2812292 octets
    hero-vertical.mp4: h264 720x1280, aac, 10.005000 s, 2711138 octets
    ambiance-selah.m4a: aac, 32.000000 s, 264167 octets

### 26.9 Dépendances et secrets

Commande :

    pnpm audit --help | rg -i "offline"

Résultat : code 1 et aucune sortie. L’aide ne propose aucun mode hors ligne ; aucun audit registre n’a donc été lancé.

- Le message pnpm indiquant que les politiques de supply chain du lockfile avaient été vérifiées un jour auparavant est un cache local, pas une preuve SCA actuelle.

Commande de scan ciblé, limitée aux fichiers suivis et ne retournant que les noms de fichiers :

    git grep -IlE -- '-----BEGIN (RSA|OPENSSH|EC|DSA) PRIVATE KEY-----|AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9]{30,}|sk-[A-Za-z0-9]{32,}|sk_[A-Za-z0-9]{32,}|xox[baprs]-[A-Za-z0-9-]{20,}|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}' -- .

Résultat : code 1 et aucune sortie, donc aucune correspondance à ces signatures PRIVATE KEY, AWS, GitHub, OpenAI/ElevenLabs, Slack ou JWT. Les valeurs des fichiers .env ignorés n’ont jamais été affichées. Ce contrôle ciblé ne remplace pas un scan professionnel de l’historique.

### 26.10 Journal d’incidents

| Incident | Symptôme | Correction/traitement | État |
|---|---|---|---|
| Répertoire parent non Git | git ne trouvait pas de dépôt | localisation du sous-répertoire selah par marqueurs réels | Résolu |
| Routage Maestro refusé | hook_blocage.py a retourné code 2, catégorie partitionnement_disque, sur la commande map contenant les identifiants gpt | refus respecté sans variante ni contournement ; audit exécuté localement | Dégradation documentée |
| Types Next absents | LayoutProps introuvable | next typegen puis typecheck rejoué | Résolu sans code |
| Build hors ligne | ENOTFOUND fonts.googleapis.com | aucune ouverture réseau ; correctif placé au Lot 0 | Non résolu, P1 |
| Première sonde ffprobe | plusieurs entrées passées dans une invocation incompatible | une sonde par fichier, résultats obtenus | Résolu |
| Première extraction de routes | formatage sed non portable | inventaire refait avec find simple | Résolu |
| Avertissements de lint | trois exports anonymes k6 | aucune correction pendant l’audit | Dette P3 |

### 26.11 Commandes de reproduction

    cd /Users/mskolosalgmail.com/Developer/TIKTOK_CRETIEN/selah
    pnpm install --frozen-lockfile --offline
    pnpm lint
    NEXT_TELEMETRY_DISABLED=1 pnpm exec next typegen
    pnpm exec tsc --noEmit --incremental false
    pnpm test
    sandbox-exec -p "(version 1) (allow default) (deny network*)" env NEXT_TELEMETRY_DISABLED=1 pnpm build
    k6 inspect k6/smoke.js
    k6 inspect k6/load.js
    k6 inspect k6/stress.js
    git status --short

Le build est attendu en échec tant que les polices restent distantes. Les autres validations listées ont réussi avec les résultats ci-dessus.

### 26.12 Fichiers de cette livraison

- Créé : AUDIT_SAAS_VIDEO_CHRETIEN.md.
- Modifié : aucun fichier applicatif, de configuration, de migration, de test ou de documentation existant.
- Supprimé : aucun fichier.
- Généré et ignoré : types Next locaux nécessaires au typecheck ; aucun changement suivi par Git.

### 26.13 Périmètre et limites résiduelles

- Audit statique/local, pas un pentest actif.
- État déployé, configuration des comptes et données de production non inspectés.
- Pas de test navigateur, lecteur d’écran, mobile réel ou mesure Lighthouse.
- Pas de migration locale Supabase exécutée faute de configuration versionnée.
- Pas de SCA en ligne ni de vérification des avis de sécurité actuels.
- Pas de test de charge effectif.
- Pas d’avis juridique.
- Build non validé tant que les polices nécessitent le réseau.

### 26.14 Contrôle mécanique du livrable

Commandes et sorties réelles :

    awk '/^## [0-9]+\./ {gsub(/\./,"",$2); printf "%s ",$2} END {print ""}' AUDIT_SAAS_VIDEO_CHRETIEN.md
    1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20 21 22 23 24 25 26

    rg -c '^### Lot [0-9]+ ' AUDIT_SAAS_VIDEO_CHRETIEN.md
    10

    awk '/^## 25\./ {inside=1} /^### 25\.1/ {inside=0} inside && /^\| F-[0-9][0-9][0-9] / {t++; if ($0 ~ /\| P0 \|/) p0++; if ($0 ~ /\| P1 \|/) p1++; if ($0 ~ /\| P2 \|/) p2++; if ($0 ~ /\| P3 \|/) p3++; if ($0 ~ /\[(Vérifié|Amélioration produit|Choix stratégique|Hypothèse à confirmer)\]/) tagged++} END {printf "total=%d P0=%d P1=%d P2=%d P3=%d tagged=%d\n",t,p0,p1,p2,p3,tagged}' AUDIT_SAAS_VIDEO_CHRETIEN.md
    total=35 P0=3 P1=15 P2=14 P3=3 tagged=35

    rg -n 'TO''DO|T''BD|À rensei''gner|PLACE''HOLDER' AUDIT_SAAS_VIDEO_CHRETIEN.md
    code 1, aucune sortie

    rg -n '[[:blank:]]+$' AUDIT_SAAS_VIDEO_CHRETIEN.md
    code 1, aucune sortie

    git diff --name-only
    aucune sortie

    git diff --cached --name-only
    aucune sortie

    git ls-files --others --exclude-standard
    AUDIT_SAAS_VIDEO_CHRETIEN.md

    git status --short
    ?? AUDIT_SAAS_VIDEO_CHRETIEN.md

    tail -n 1 AUDIT_SAAS_VIDEO_CHRETIEN.md
    Audit terminé. Aucun code applicatif n’a été modifié. J’attends ta validation avant toute implémentation.

## Synthèse terminale demandée

### État actuel

MVP/PWA fonctionnel et prometteur, mais **non qualifié pour une bêta externe**. Les tests unitaires, le lint et le typecheck passent ; le build hors ligne échoue ; trois P0 et quinze P1 sont ouverts.

### Stack

Next.js 16.3, React 19.2, TypeScript 5.9, Tailwind 4, Supabase Auth/Postgres/RLS/Realtime/Storage, pnpm 11, Vitest 4 et k6.

### Comptes utiles

- 144 fichiers suivis ;
- 17 pages ;
- 1 route API ;
- 28 Server Actions ;
- 29 points d’entrée asynchrones applicatifs en comptant la route ;
- 19 tables, 3 vues, 7 index explicites ;
- 4 suites et 35 tests ;
- 3 P0, 15 P1, 14 P2, 3 P3.

### Validations

- Installation hors ligne : réussie.
- Lint : réussi, 0 erreur, 3 warnings.
- Typecheck : réussi après génération officielle des types Next.
- Tests : 35/35 réussis.
- Build hors ligne : échoué sur Google Fonts.
- Scénarios k6 : trois fichiers inspectés, non exécutés.
- État Git initial : propre.

### P0

1. Auto-élévation du rôle utilisateur.
2. Désanonymisation directe des prières anonymes.
3. Accès persistant aux vidéos masquées.

### P1

1. Champs système vidéo manipulables.
2. Validation média côté client et stockage public.
3. Traduction publique sans borne.
4. Absence de protection mineurs/mentorat.
5. Modération sans dossier/sanction/appel.
6. Salles fermées écrivable.
7. Tableau pasteur sans garde de rôle.
8. Dérive locale/lang/video_translations.
9. Objets orphelins et absence d’idempotence.
10. Socle confidentialité/juridique absent.
11. Hygiène des secrets dans les scripts.
12. Build non hermétique et absence de CI.
13. Observabilité/PRA absents.
14. Anti-abus/rate limit absent.
15. Flux instable et non scalable.

### Cinq forces

1. Positionnement chrétien réellement différencié.
2. RLS activée sur toutes les tables applicatives.
3. TypeScript strict et i18n typée avec RTL.
4. Identité mobile et visuelle cohérente.
5. Socle de tests unitaires rapide et vert.

### Cinq priorités

1. Fermer les trois P0.
2. Rendre schéma, build et CI reproductibles.
3. Construire un pipeline média privé et idempotent.
4. Mettre en place Trust & Safety, notamment pour les mineurs.
5. Cadrer confidentialité, droits média et modèle économique.

### Trois quick wins

1. Bloquer role/champs système et ajouter les gardes serveur.
2. Protéger la traduction et interdire les écritures dans les salles fermées.
3. Retirer les faux signaux sociaux et localiser les polices.

### Trois décisions produit

1. Public visé et présence de mineurs.
2. Philosophie du flux : édification/diversité versus engagement.
3. Modèle commercial : B2C, organisations, dons ou combinaison.

### Trois décisions juridiques

1. Base légale et traitement des données religieuses/prière.
2. Règles de mentorat, âge et protection des mineurs.
3. Droits sur vidéos, sermons, musique, voix et mécanisme de dons.

### Chemin du rapport

/Users/mskolosalgmail.com/Developer/TIKTOK_CRETIEN/selah/AUDIT_SAAS_VIDEO_CHRETIEN.md

Audit terminé. Aucun code applicatif n’a été modifié. J’attends ta validation avant toute implémentation.
