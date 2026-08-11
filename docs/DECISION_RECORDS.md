# Décisions à valider avant publication

Ces fiches consignent les choix explicites, leur responsable, leurs preuves et
les modifications techniques qu’ils autorisent. Elles ne remplacent pas les
preuves juridiques, produit ou fournisseur requises avant publication.

> Depuis le 11 août 2026, les décisions d'architecture sont versionnées une par
> fichier dans [`adr/`](adr/README.md), avec un statut appartenant à une liste
> fermée. Ce document conserve les **autorisations datées** données par
> l'utilisateur ; les fiches `D-00x` ci-dessous sont reprises et développées par
> les ADR correspondants. En cas d'écart, l'ADR fait foi.

## Validation enregistrée — 10 août 2026

L'utilisateur a validé les « recommandations sécurisées par défaut » : aucune
publication ni déploiement ; les nouvelles relations de mentorat et les nouveaux
dépôts/publications vidéo sont suspendus localement. Les données et vidéos
existantes sont conservées. Cette validation n'approuve pas un cadre mineurs,
un pipeline média, une politique de données, ni une ouverture publique.

Le déploiement applicatif production a ensuite été explicitement autorisé par
l'utilisateur le 10 août 2026. Il n'ouvre pas les dépôts vidéo ni le mentorat :
les garde-fous `0015` restent actifs sur le projet Supabase cible.

Une autorisation explicite ultérieure du 10 août 2026 a réactivé les nouvelles
vidéos et le mentorat sous contrôles. La migration `0016` restaure uniquement
les policies et écrans nécessaires ; les quotas, la modération, la
confidentialité et la conservation des contenus restent obligatoires.

## Validation enregistrée — 11 août 2026

L'utilisateur a levé explicitement l'obligation de demander une autorisation
par action : Git (commit, merge, push), les migrations Supabase et le
déploiement de production Vercel s'exécutent désormais en autonomie. Cette
levée ne couvre ni dépense réelle, ni paiement, ni souscription, ni nouveau
fournisseur payant, qui restent soumis à une autorisation ponctuelle. Elle ne
lève aucune des décisions produit bloquées ci-dessous ni dans `adr/`.

Une autorisation explicite du 10 août 2026 a ensuite fixé la durée générale du
Mode Sabbat à 12 heures et demandé une exemption limitée au compte de test
actif dans Safari. L'identité visible `@qa_timothee` a été confirmée avant
action ; `endSabbath` utilise la session authentifiée et le prédicat `id =
user.id`. Aucun autre profil n'est ciblé.

## D-001 — Public mineur et mentorat

- **Décision** : audience réservée aux majeurs, ou mineurs admis sous un cadre
  de vérification et supervision défini.
- **Options** : désactiver mentorat ; majeurs uniquement ; programme mineurs
  avec consentement, vérification, supervision et escalade.
- **Preuves requises** : territoires, règles, responsables, procédure urgence,
  test de blocage/signalement et avis juridique adapté.
- **Impact technique** : champs d’âge/consentement, contrôles d’accès,
  supervision mentor, blocage et parcours d’alerte.
- **Validation** : **approuvée par défaut sécurisé** : mentorat suspendu par
  `0015_safety_default_pause.sql` en attendant un cadre complet.

## D-002 — Pipeline média

- **Décision** : fournisseur et architecture de dépôt, quarantaine,
  antivirus/transcodage, sous-titres et purge.
- **Options** : pipeline géré approuvé ; pipeline interne opéré ; maintenir le
  dépôt fermé jusqu’à disponibilité du pipeline.
- **Preuves requises** : région, DPA, limites de coût, tests de fichier hostile,
  reprise, purge et alertes.
- **Impact technique** : remplacement du dépôt direct, états de traitement,
  job de réconciliation et publication différée.
- **Validation** : **approuvée par défaut sécurisé** : nouveaux dépôts et
  nouvelles publications suspendus par `0015_safety_default_pause.sql` en
  attendant le pipeline complet.

## D-003 — Données, confidentialité et rétention

- **Décision** : bases légales, territoires, rétention, droits d’accès/export/
  suppression et sous-traitants.
- **Preuves requises** : politiques révisées, canal de contact, registre,
  responsable et procédure DSAR.
- **Impact technique** : export, suppression différée, gel de preuve et
  paramètres de consentement.
- **Validation** : _à renseigner_ ; la publication reste fermée par défaut.

## D-004 — Modération et appels

- **Décision** : taxonomie, seuils, sanctions, SLA, appel et conservation des
  dossiers.
- **Preuves requises** : playbook, équipe/astreinte, formation et exercice
  d’incident.
- **Impact technique** : case management, sanctions, appels, notifications et
  règles de conservation. Le journal technique existe déjà, mais pas ce modèle.
- **Validation** : _à renseigner_ ; la publication reste fermée par défaut.

## D-005 — Exploitation et continuité

- **Décision** : fournisseur de monitoring, RPO/RTO, sauvegardes, alertes et
  responsables d’intervention.
- **Preuves requises** : exercice de restauration daté et mesuré, canaux
  d’alerte, propriétaire de chaque signal.
- **Impact technique** : connecteurs métriques, jobs planifiés et procédure de
  restauration validée.
- **Validation** : _à renseigner_ ; la publication reste fermée par défaut.

## D-006 — Recommandation et exposition publique

- **Décision** : objectifs de classement, signaux admis, diversité, contrôle
  utilisateur et métriques de sécurité.
- **Preuves requises** : spécification produit, jeu de tests, seuils d’abus et
  analyse d’impact.
- **Impact technique** : candidats du feed, scoring versionné, préférences et
  observabilité. Le curseur de pagination existe déjà.
- **Validation** : _à renseigner_ ; la publication reste fermée par défaut.
