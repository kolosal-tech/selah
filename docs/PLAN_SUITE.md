# Plan de suite — Selah

Établi le 14 août 2026 sur l'état vérifié du dépôt (`f5d554d`, cycle 23) et
sur un inventaire de 206 restes tracés dans les ADR, `state.md`,
`OPERATIONS_RUNBOOK.md`, `IMPLEMENTATION_STATUS.md`, `ROADMAP.md` et le code.
Chaque élément renvoie à sa source ; ce document ordonne, il ne redécrit pas.

## Où en est le produit

Livré et prouvé en production : vagues 0 et 1 de `OBJECTIF_CLAUDE_EVOLUTION.md`.
Mesure produit et anonyme, métriques terrain, feature flags, gouvernance (13
ADR), gestes de mise à distance avec leur page de gestion, taxonomie de
signalement, dossiers de modération avec sanctions et appels, export de
compte, suppression différée 14 jours, révocation de sessions, attestation
18+ fermant le mentorat par défaut.

Trois ADR portent des **hypothèses**, pas des décisions : `ADR-0011` (18+ par
attestation), `ADR-0012` (sanctions 7/30 jours, appel sous 30 jours),
`ADR-0013` (export JSON, suppression différée 14 jours). Le code les applique
déjà ; il te reste à les confirmer ou les corriger.

## Piste A — je lance sur un mot, aucune décision requise

Ordonnés par valeur/risque décroissant. Chaque lot suit le cycle habituel :
audit, implémentation, tests, migration, déploiement, preuve sur la cible.

| # | Lot | Contenu | Source |
|---|---|---|---|
| A1 | Abonnements / Découvrir | Onglet du fil restreint aux auteurs suivis (la table `follows` est déjà lue), classement versionné avec nom de version exposé. Suivre un compte a enfin un effet visible. | Vague 3 ; F-018 ; ADR-0007 |
| A2 | Protection de l'entrée Auth | Limitation d'inscription/connexion côté serveur (F-017), aujourd'hui absente devant Supabase. Réduit aussi l'exposition à la limite d'e-mails rencontrée au cycle 23. | F-017 ; state.md#Cycle 23 |
| A3 | Exercice de restauration PITR | Restauration réelle dans un environnement jetable, RPO/RTO mesurés, portée sur Storage constatée par écrit. Préalable exigé par quatre ADR ; la sauvegarde seule ne prouve rien. | RUNBOOK#Restauration ; ADR-0004/5/6 |
| A4 | Studio créateur v1 | Brouillons, aperçu avant publication, programmation, séries. Statut `draft/scheduled` sur `videos` + déclencheur de publication. Sans fournisseur externe. | Vague 2 ; ROADMAP Phase 2 |
| A5 | Onboarding par intention | Témoigner / prier / écouter / servir / rejoindre, toutes personnalisations sautables. | Vague 3 |
| A6 | Notifications Web Push opt-in | VAPID (gratuit, sans FCM), consentement explicite, granularité par type, et le Mode Sabbat coupe enfin quelque chose de réel. | Vague 3 ; ROADMAP Phase 2 |
| A7 | Élargir la QA navigateur | Projets Playwright WebKit/Safari + parcours clavier complets. | Critère global 4 |
| A8 | Exploitation locale | Installer le job launchd d'alertes, étendre la sonde à Supabase (advisors, volume `product_events`, signalements > 24 h), planifier les purges si tu autorises `pg_cron`. | ALERTES.md ; state.md#Cycle 18 |
| A9 | Dettes techniques | Unifier `profiles.lang`/`locale` (aucune des deux n'est lue), auditer puis valider la contrainte avatar `NOT VALID`, mesurer l'entrée audio réelle des rooms (`room_joined`), mettre à jour F-008. | inventaire code Q3/Q8 ; state.md#Cycle 16 |
| A10 | Baseline ASVS | Checklist OWASP ASVS 5 L2 versionnée + passe WSTG sur préproduction. | Critère global 2 |
| A11 | MFA / passkey | Enrôlement TOTP optionnel si la configuration Supabase Auth le permet sans fragiliser les parcours actuels. | Vague 1 (reliquat) |
| A12 | Fiches fournisseurs en service | Renseigner la grille ADR-0005 (région, DPA, coût, quota, portabilité, sortie) pour Supabase, Vercel et la traduction. Documentaire. | ADR-0005 |

Recommandation de lancement : **A1 + A2** (produit + sécurité, immédiat),
puis **A3** (elle conditionne trois ADR), puis A4–A6.

## Piste B — tes décisions, regroupées en six paquets

Aucun code n'attend autre chose que ces arbitrages. Les détails et preuves
exigées sont dans chaque ADR ; voici l'essentiel à trancher.

**B1 — Valider les trois hypothèses (15 minutes).** Confirme ou corrige
ADR-0011, ADR-0012, ADR-0013. Le code est déjà conforme ; ta validation les
fait passer d'« hypothèse » à « décision ».

**B2 — Exploitation et responsables.** Huit signaux du runbook attendent un
nom (même si c'est « moi » partout) ; RPO 24 h / RTO 4 h à valider après
l'exercice A3 ; cadences de revue (réconciliation média, restauration,
rotation des secrets, quotas, modération). **Urgent dans ce paquet : la
rotation de la clé `service_role`** affichée en clair au cycle 23 — geste
tableau de bord Supabase, à coordonner avec tout consommateur externe.

**B3 — Fournisseurs et dépenses.** Cinq choix, chacun = fiche ADR-0005 +
autorisation écrite de dépense : SMTP transactionnel (la limite de 2
e-mails/heure du fournisseur intégré bloque les resets — le plus urgent) ;
TURN/SFU pour l'audio (vague 4) ; antivirus + transcodage média (vague 2) ;
télémétrie d'erreur ; traduction réelle derrière `TRANSLATE_API_URL`.

**B4 — Droits média (ADR-0004).** Texte de provenance au dépôt, forme du
consentement image/voix, canal de retrait avec délai, rétroactivité du corpus
existant. Conditionne l'ouverture large de la vague 2.

**B5 — Confidentialité et rétention (ADR-0003).** Politique par table/bucket,
traitement des demandes d'accès, `pg_cron` pour les purges. Le squelette
technique existe (purges livrées, export livré) ; il manque la politique.

**B6 — Paiement (ADR-0006, vague 5).** Revue juridique, CGV, politique de
remboursement, prestataire, grille tarifaire. Aucun code avant ces cinq
écrits ; ensuite le moteur d'entitlements et le bac à sable se construisent
sans débit réel.

## Piste C — ce que toi seul peux faire physiquement

- Test audio live sur **deux appareils réels, deux réseaux** (Wi-Fi, 4G/5G,
  NAT restrictif) — jamais exercé, gate de la vague 4.
- Observer la **livraison réelle d'un e-mail de reset** dans une boîte (lié au
  choix SMTP de B3).
- Caméra/micro **matériels** sur le studio (les tests actuels simulent).
- Programme commercial des 12 semaines : entretiens, cohorte fondatrice,
  pilotes — préalable à toute dépense d'acquisition (critère global 8).
- Comptes développeur des stores si les apps Expo se lancent (dépense).

## Ordre recommandé

1. **Maintenant** : B1 (15 min) + lancer A1+A2. En parallèle B3-SMTP, le plus
   petit choix de fournisseur au plus gros effet immédiat.
2. **Ensuite** : A3 (restauration), puis B2 (les responsables se nomment en
   une réponse).
3. **Semaine suivante** : A4–A6 pendant que B4/B5 mûrissent.
4. **Vague 4** quand le TURN/SFU est choisi (B3) et testé à deux appareils (C).
5. **Vague 5** seulement après B6 complet.

## Prompts prêts à coller

- `Valide ADR-0011 tel quel, ADR-0012 tel quel, ADR-0013 tel quel` — ou tes
  corrections ; je remplace les ADR et j'aligne le code s'il y a écart.
- `Lance A1 et A2` — ou tout autre numéro de la piste A, seuls ou combinés.
- `SMTP : je choisis <fournisseur>, budget <montant>/mois` — je prépare la
  fiche ADR-0005, la configuration et la preuve de livraison.
- `Responsable de tous les signaux du runbook : moi` — je remplis la colonne
  et j'active les cadences par défaut proposées.
- `Lance l'exercice de restauration` — A3, avec rapport RPO/RTO daté.

Chaque lot livré suit la règle constante : preuve sur la cible réelle,
`state.md` mis à jour, aucun secret exposé, aucune dépense sans ton accord.
