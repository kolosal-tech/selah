# Objectif Claude Code — Évolution, robustesse et monétisation de Selah

## Prompt prêt à transmettre

Lis intégralement `AGENTS.md`, `state.md`, `HANDOFF_CLAUDE.md`, puis le présent
document. Travaille uniquement dans la racine Git `selah/` et vérifie l'état
réel avant de réutiliser les informations ci-dessous.

**Objectif :** transformer Selah en une plateforme chrétienne francophone sûre,
fiable, désirable et économiquement durable, sans dégrader les parcours déjà
validés de vidéo, prière, authentification, profil et rooms audio.

Tu as la liberté d'ajouter, retirer, fusionner ou différer une fonctionnalité si
la décision améliore mesurablement la valeur utilisateur, la sécurité, la
robustesse ou l'économie du produit. Toute initiative ajoutée doit cependant
avoir : une hypothèse explicite, une métrique de succès, un coût estimé, un test,
un mécanisme de retour arrière et, si elle est risquée, un feature flag désactivé
par défaut. Ne copie pas mécaniquement TikTok, YouTube ou Facebook : adapte leurs
bons mécanismes à la mission et à l'éthique de Selah.

Exécute le travail par vagues verticales utilisables. Pour chaque vague : audit
du réel, plan de 1 à 5 actions, implémentation, tests, revue sécurité, mesure,
documentation et verdict binaire. Corrige puis rejoue les preuves jusqu'à ce que
les critères soient satisfaits. Une suite verte ne suffit pas si le parcours
réel, l'isolation multi-compte ou le rendu mobile ne sont pas prouvés.

Tu peux modifier le code, les tests, les migrations et la documentation locale,
installer une dépendance justifiée et préparer des intégrations en bac à sable.
Pour les ambiguïtés non critiques, formule une hypothèse raisonnable et avance
sans interrompre la vague. Tu ne dois pas engager de dépense, déclencher un
débit réel, choisir définitivement un fournisseur, migrer/déployer la
production, traiter des comptes personnels ou ouvrir une fonctionnalité à
risque sans autorisation explicite dans la conversation Claude courante.

## Situation de départ à revalider

- Production connue : `https://selah-wheat.vercel.app` ; la dernière livraison
  a validé vidéo/audio, reset, profil, préférences et rooms P2P.
- Socle : Next.js 16, React 19, TypeScript strict, Supabase Auth/Postgres/RLS/
  Realtime/Storage, Vitest, Playwright et k6.
- Baseline : 138 tests Vitest, RLS et reconstruction du schéma verts ; Playwright
  desktop/Pixel 7 et publication média avec nettoyage ; charge sans erreur
  jusqu'à 150 utilisateurs virtuels.
- Limites connues : pas de télémétrie d'erreur dédiée, médias navigateur simulés,
  reset SMTP non observé, live en mesh quatre pairs sans TURN/SFU, pipeline média
  sans quarantaine/antivirus/transcodage, gouvernance mineurs/modération/données
  encore incomplète et aucun système de paiement.

Ces éléments sont des points de contrôle, pas une vérité permanente : revalide
Git, la CI, Supabase, Vercel et l'interface avant toute déclaration.

## Principes produit non négociables

1. La prière, l'écoute communautaire, le signalement et la sécurité ne sont
   jamais payants.
2. Pas de ciblage publicitaire fondé sur les prières, la confession, les
   convictions ou une inférence religieuse individuelle.
3. Pas de faux compteur, faux direct, faux témoignage, dark pattern ou promesse
   spirituelle liée à un achat.
4. Les mineurs, le mentorat, les dons, les droits média et la modération restent
   fermés ou limités tant que leurs décisions et preuves ne sont pas validées.
5. Confidentialité par défaut, collecte minimale, export/suppression et durée de
   conservation explicite.
6. Accessibilité WCAG 2.2 AA, mobile d'abord, 12 langues et RTL sans parcours de
   seconde classe.

## Critères de succès globaux

1. Chaque nouvelle capacité possède une spécification, des événements de mesure,
   des tests positifs/négatifs, une documentation et un rollback.
2. Les contrôles techniques atteignent une baseline OWASP ASVS 5 niveau 2 sur le
   périmètre web, avec matrice RLS multi-rôle et aucun secret dans Git/artefacts.
3. Le service possède alertes, journaux exploitables, sauvegarde et restauration
   réellement exercée ; les incidents Auth, Storage, Realtime et paiement sont
   attribuables sans exposer de données sensibles.
4. Playwright couvre desktop, Pixel 7, Safari/WebKit et les parcours clavier ;
   les médias et le live sont aussi validés sur au moins deux appareils physiques
   et deux réseaux distincts avant ouverture large.
5. Les objectifs terrain au p75 sont LCP <= 2,5 s, INP <= 200 ms et CLS <= 0,1 ;
   les parcours serveur conservent p95 < 1,5 s et moins de 1 % d'échec.
6. Le produit mesure activation, rétention, sécurité, coût média et conversion
   sans stocker le texte des prières ou les contenus privés dans l'analytics.
7. Une offre payante en bac à sable prouve droits d'accès, webhooks idempotents,
   annulation, remboursement simulé et absence d'accès après expiration.
8. Une expérimentation commerciale obtient des engagements mesurables de
   créateurs/églises avant toute généralisation ou dépense d'acquisition.

## Plan d'évolution par vagues

### Vague 0 — Mesure, gouvernance et architecture

- Créer un catalogue d'événements minimal et respectueux de la vie privée :
  inscription réussie, première lecture, première publication, première prière,
  room rejointe, retour J1/J7/J30, erreur et abandon. Exclure contenu, e-mail,
  identifiants directs et texte libre.
- Versionner les décisions produit : public/âge, modération, rétention, droits
  média, fournisseurs, paiement et philosophie du classement.
- Ajouter feature flags, budgets de coût et un journal d'architecture pour les
  composants à risque.
- Définir les SLO, propriétaires d'alertes, RPO/RTO initiaux et tableau de bord.

**Sortie :** métriques fiables et décisions bloquantes visibles. Aucune nouvelle
fonctionnalité de croissance ne part sans cette instrumentation.

### Vague 1 — Trust & Safety et cycle de compte

- Livrer blocage, mute, « ne plus recommander », gestion de dossiers de
  signalement, sanctions, appels et journal d'administration append-only.
- Ajouter export de compte, suppression différée, révocation des sessions,
  historique des appareils et option MFA/passkey si Supabase le permet sans
  fragiliser les parcours actuels.
- Définir âge minimal et désactiver le mentorat des mineurs tant qu'un cadre de
  consentement, vérification, supervision et urgence n'est pas approuvé.
- Concevoir une politique de rétention par table/bucket et un traitement des
  demandes d'accès/suppression.

**Gate :** tests intercomptes, anti-auto-modération, preuve de suppression et
revue humaine des scénarios d'abus.

### Vague 2 — Pipeline média et valeur créateur

- Remplacer la publication directe par des états `uploaded`, `quarantined`,
  `processing`, `ready`, `rejected` ; valider MIME/signature/durée côté serveur.
- Préparer antivirus, transcodage adaptatif, miniature, sous-titres, reprise
  résumable et réconciliation automatique des objets orphelins. Aucun fournisseur
  n'est activé sans fiche région, DPA, coût, quota et sortie de secours.
- Ajouter brouillons, aperçu avant publication, programmation, suppression,
  playlists/séries et visibilité explicite.
- Créer un Studio créateur : contenus, statut, portée utile, rétention, sécurité
  et coûts, sans transformer l'engagement compulsif en objectif unique.

**Gate :** fichiers hostiles/refusés, retry idempotent, interruption réseau,
quota, purge et accessibilité média testés.

### Vague 3 — Rétention utile et découverte maîtrisée

- Onboarding par intention : témoigner, prier, écouter, servir, rejoindre une
  communauté ; permettre de sauter toutes les personnalisations.
- Distinguer « Abonnements » et « Découvrir », avec classement versionné,
  diversité, fraîcheur, contrôle utilisateur et explication simple.
- Ajouter sauvegarde, historique privé, reprise de lecture, rappels opt-in,
  partage profond et notifications granulaires.
- Mettre en place PWA/offline borné, mode économie de données et variantes média.

**Gate :** aucune notification sans consentement, aucune inférence religieuse
exportée, tests de biais/diversité et mesure réelle de D7/D30.

### Vague 4 — Audio live de production

- Isoler une interface fournisseur puis comparer au moins : TURN auto-hébergé,
  SFU managé et SFU auto-hébergé selon fiabilité, région, DPA, coût par minute,
  modération, enregistrement et portabilité.
- Ajouter salle d'attente, lever la main, rôles hôte/cohôte/intervenant/auditeur,
  mute serveur autoritaire, reconnexion, indicateur réseau et consentement
  explicite avant tout enregistrement.
- Tester deux appareils réels sur Wi-Fi, 4G/5G, NAT restrictif, perte réseau,
  changement de périphérique et refus de permission.

**Gate :** le pilote P2P reste limité tant qu'un TURN/SFU et des tests média
spécifiques n'ont pas démontré le taux de connexion et le coût cible.

### Vague 5 — Organisations et monétisation en bac à sable

- Créer organisations/églises, membres, invitations, rôles, branding léger,
  calendrier, rooms planifiées, équipe de modération et statistiques agrégées.
- Construire un catalogue de plans et un moteur d'entitlements indépendant du
  fournisseur de paiement.
- En bac à sable uniquement : checkout, portail client, webhooks signés et
  idempotents, essai, changement de plan, annulation, échec, remboursement,
  facture et rapprochement. Aucun rôle n'est accordé depuis le client.
- Ajouter une page de prix expérimentale et un écran « pourquoi payer » clair ;
  mesurer l'intention avant l'ouverture des débits.

**Gate :** revue juridique/fiscale, CGV, politique de remboursement, DPA,
comptabilité et autorisation explicite avant premier paiement réel.

## Plan de vérification sécurité et robustesse

### À chaque pull request

```bash
pnpm install --frozen-lockfile
NEXT_TELEMETRY_DISABLED=1 pnpm exec next typegen
pnpm lint
pnpm exec tsc --noEmit --incremental false
pnpm test
pnpm test:rls
pnpm test:schema
NEXT_TELEMETRY_DISABLED=1 pnpm build
pnpm test:e2e
pnpm audit --prod --audit-level=high
git diff --check
```

Ajouter : scan de secrets du diff et de l'historique, SBOM, contrôle de licence,
tests d'accessibilité, budget bundle et tests visuels des routes modifiées.

### Matrice sécurité obligatoire

- **Identité :** inscription, reset, expiration, révocation, MFA, enumeration,
  brute force, fixation de session, redirection et cookies.
- **Autorisation :** matrice anonyme/membre/auteur/modérateur/admin sur chaque
  table, RPC, route, Server Action, canal Realtime et bucket Storage.
- **Entrées :** XSS, injections, CSRF, SSRF, URLs, fichiers polyglottes,
  décompression, métadonnées, taille/durée et noms de chemins.
- **Vie privée :** minimisation, consentement, export, suppression, rétention,
  accès support et journalisation sans contenu sensible.
- **Paiement :** signature/rejeu de webhook, idempotence, incohérence facture/
  entitlement, fraude, remboursement et moindre privilège.
- **Supply chain :** dépendances verrouillées, provenance, vulnérabilités hautes,
  actions CI épinglées et secrets uniquement dans les coffres prévus.

Maintenir une checklist ASVS versionnée et effectuer un test WSTG autorisé sur
staging avant chaque jalon public ; aucun pentest agressif n'est lancé sur la
production sans périmètre écrit.

### Robustesse et exploitation

- Unitaires sur les règles métier ; intégration sur Supabase/Storage/Realtime ;
  contract tests pour fournisseurs ; E2E sur parcours critiques et échecs.
- Réseau lent/offline, double clic, retry, session expirée, quota, fichier
  corrompu, Storage indisponible, Realtime interrompu et migration partielle.
- k6 smoke à chaque release, load planifié, stress/spike avant campagne ; tester
  séparément HTTP, upload et média live. Ne jamais extrapoler au-delà du palier
  réellement observé.
- Canary, migration compatible N/N-1, rollback documenté et vérification après
  déploiement. Sauvegarde seule insuffisante : restaurer dans un environnement
  jetable et mesurer RPO/RTO.
- Installer une télémétrie d'erreur approuvée ou une alternative OpenTelemetry,
  avec redaction, échantillonnage et alertes. Corréler version, route et provider,
  jamais le texte d'une prière.

## Plan de monétisation recommandé

Le modèle recommandé est **B2B2C hybride** : une communauté gratuite crée la
valeur réseau ; les organisations et créateurs paient pour opérer, administrer,
analyser et développer leur activité ; l'abonnement individuel reste facultatif.

### Offres à tester — prix hypothétiques, pas tarifs validés

| Offre | Valeur proposée | Hypothèse initiale |
|---|---|---:|
| Selah Gratuit | vidéo, prière, écoute, rooms de base, sécurité | 0 € |
| Selah+ | hors-ligne, routines, favoris avancés, confort sans sponsor | 4,99 €/mois ou 49 €/an |
| Créateur Pro | brouillons, programmation, séries, Studio et exports | 12 €/mois ou 120 €/an |
| Église Essentiel | espace, calendrier, rôles, rooms et modération | 59 €/mois |
| Église Croissance | équipes, analytics agrégés, intégrations et quotas | 149 €/mois |
| Réseau/Union | SSO, multi-organisations, SLA et accompagnement | devis |

Ne code pas ces montants en dur. Versionne le catalogue et teste la disposition
à payer par entretiens, fausse porte honnête et pilotes. Commencer par les offres
Église et Créateur, dont la valeur est plus démontrable, avant de pousser Selah+.

### Revenus complémentaires, seulement après les fondations

- Séries ou événements payants : commission transparente hypothétique de 5 à
  8 %, hors frais de paiement, avec droits média et remboursements.
- Soutien/dons : flux séparé, bénéficiaire clairement identifié, aucun reçu
  fiscal promis sans cadre compétent et aucune commission cachée.
- Sponsoring contextuel éthique : partenaires vérifiés, label visible, aucun
  ciblage par prière/conviction, aucun placement pendant une prière ou une crise.
- Services B2B : onboarding, formation, migration de contenu et support premium.
- Partage créateur : seulement après KYC, antifraude, comptabilité, modération et
  seuil de trésorerie validés.

### Économie unitaire à instrumenter

- MRR/ARR, revenu moyen par offre, marge brute après Storage/CDN/transcodage/
  live/support, churn, expansion et créances.
- CAC par canal, délai de récupération, LTV conservatrice et taux essai-payant.
- Coût par minute vidéo, minute live, utilisateur actif et organisation.
- Hypothèses de départ : marge brute >= 70 %, récupération du CAC B2B < 6 mois,
  conversion pilote Église >= 25 %. Recalibrer après données réelles.

## Plan marketing et commercial

### Positionnement

« Selah est l'espace chrétien francophone pour partager des témoignages courts,
prier ensemble et animer une communauté dans un cadre sûr et maîtrisé. »

Ne pas promettre « le TikTok chrétien » comme unique identité. Vendre la confiance,
la qualité relationnelle, la prière en direct et les outils d'organisation.

### Marchés prioritaires

1. Églises francophones de 100 à 2 000 membres ayant déjà une équipe média.
2. Créateurs, pasteurs et responsables de prière publiant chaque semaine.
3. Membres recherchant un usage spirituel volontaire plutôt qu'un flux infini.

### Programme de lancement sur douze semaines

1. **Semaines 1–2 :** 20 entretiens, dont 8 églises, 8 créateurs et 4 membres ;
   consigner problèmes, solution actuelle, budget et objection principale.
2. **Semaines 3–4 :** page d'attente segmentée, démo de trois minutes, charte de
   sécurité et prix sous forme de test d'intention sans prélèvement.
3. **Semaines 5–8 :** cohorte fondatrice de 10 organisations et 20 créateurs ;
   onboarding assisté, objectifs hebdomadaires et support direct.
4. **Semaines 9–10 :** publier deux études de cas autorisées, kit ambassadeur,
   liens profonds et programme de recommandation anti-spam.
5. **Semaines 11–12 :** proposer un pilote payant aux comptes activés, analyser
   objections, marge et support, puis décider go/pivot/stop par segment.

Canaux : partenariats d'églises, créateurs fondateurs, démonstrations en ligne,
contenus éducatifs réutilisables sur Shorts/Reels/TikTok, SEO sur témoignage et
prière, parrainage opt-in. Ne pas acheter de trafic avant preuve de rétention.

### Entonnoir et critères de décision

- Acquisition : visite qualifiée -> inscription.
- Activation : première action de valeur dans les 24 h.
- Rétention : retour J7/J30 par intention initiale.
- Communauté : publication utile, réponse, prière rejointe, signalements traités.
- Revenu : intérêt prix -> essai -> paiement -> renouvellement.
- Sécurité : taux de contenu signalé, délai de traitement, récidive et appels.

Objectifs initiaux à tester : activation >= 40 %, rétention J7 >= 25 %, pilote
Église vers payant >= 25 %, support critique sous 4 h. Ne pas optimiser une
métrique d'engagement si elle détériore bien-être, diversité ou sécurité.

### Matériel commercial à produire

- Page prix et comparaison des plans sans option trompeuse.
- One-page Église, présentation de démonstration et script de découverte.
- Checklist d'onboarding, proposition de pilote 30 jours et fiche sécurité.
- Pipeline commercial simple : lead, qualifié, démo, pilote, gagné/perdu, motif.
- Études de cas avec consentement, chiffres vérifiables et aucun témoignage créé.

## Livrables attendus de Claude Code

Pour chaque vague, fournir :

1. fichiers créés/modifiés/supprimés ;
2. décisions et hypothèses, avec fonctionnalités ajoutées de sa propre initiative ;
3. sorties exactes des tests et preuves navigateur/SQL ;
4. journal des incidents et corrections ;
5. migrations, variables et fournisseurs préparés mais non activés ;
6. impacts sécurité, vie privée, accessibilité, coûts et rollback ;
7. métriques avant/après et verdict par critère ;
8. prochaine vague recommandée, sans masquer les limites.

Arrêt autorisé uniquement sur succès prouvé de la vague, budget de cinq cycles
épuisé, blocage externe réel ou deux cycles sans progrès. Dans les autres cas,
continuer, changer de stratégie en cas d'échec répété et laisser le worktree
propre ou expliquer exactement pourquoi il ne l'est pas.

## Références de cadrage

- OWASP ASVS 5.0 : https://owasp.org/www-project-application-security-verification-standard/
- OWASP WSTG : https://owasp.org/www-project-web-security-testing-guide/
- CNIL, données sensibles : https://www.cnil.fr/fr/definition/donnee-sensible
- Commission européenne, AIPD : https://commission.europa.eu/law/law-topic/data-protection/information-business-and-organisations/obligations/when-data-protection-impact-assessment-dpia-required_en
- Core Web Vitals : https://web.dev/articles/defining-core-web-vitals-thresholds
- YouTube Partner Program : https://support.google.com/youtube/answer/72851
- TikTok Creator Rewards/Series : https://support.tiktok.com/en/business-and-creator
- Meta Content Monetization : https://about.fb.com/news/2024/10/monetize-content-facebooks-new-streamlined-program/
- Stripe Billing, à titre d'architecture seulement : https://docs.stripe.com/billing/subscriptions/overview
