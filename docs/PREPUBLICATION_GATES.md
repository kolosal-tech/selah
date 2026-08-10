# Décisions et preuves exigées avant publication

Ce document prépare la décision de mise en ligne ; il ne vaut ni publication,
ni avis juridique, ni approbation des choix ci-dessous.

Les fiches à compléter sont dans `DECISION_RECORDS.md`.

## État au 10 août 2026

La publication applicative production est **active sous contrôles** depuis le
10 août 2026 : la réactivation des nouvelles vidéos et du mentorat a été
explicitement autorisée et déployée via `0016`. Chaque extension de périmètre
conserve son exigence de responsable et de preuve avant ouverture.
Avant ce déploiement, la publication était **bloquée** tant que chaque point
ci-dessous n'avait pas reçu un responsable, une date, une preuve et une
validation explicite du produit.
Les migrations de sécurité ajoutées au dépôt doivent aussi être appliquées à
l'environnement cible et validées sur ses données réelles avant toute ouverture.
La pause `0015` reste l'état de repli documenté ; `0016` réactive les parcours
contrôlés sans ouvrir d'accès anonyme ni supprimer les décisions ci-dessous.

## Décisions produit et protection des personnes

| Décision attendue | Preuve à joindre avant publication |
|---|---|
| Public admis et âge minimal, par territoire | Règle validée, parcours d'âge et traitement des refus |
| Mentorat | Soit désactivation complète, soit vérification, supervision, blocage/signalement, escalade et règles mineurs validés |
| Modération | Taxonomie, rôles, délais de traitement, procédure d'urgence, sanctions, appels et conservation des preuves |
| Données sensibles | Politique de confidentialité, rétention, export/suppression, contact et registre des sous-traitants revus par un professionnel compétent |
| Droits média | Provenance, licences, consentements image/voix et procédure de retrait pour chaque contenu publié |

## Décisions fournisseur et exploitation

| Décision attendue | Preuve à joindre avant publication |
|---|---|
| Traduction | Fournisseur approuvé, régions de traitement, conditions de transfert de texte et plafond de coût ; la limite authentifiée partagée est versionnée, l'entrée publique reste à protéger |
| Média | Pipeline de mise en quarantaine, validation serveur, antivirus/transcodage, sous-titres et purge des objets orphelins ; les retries et inventaires de réconciliation sont versionnés |
| Sauvegarde et incident | Fréquence de sauvegarde, test de restauration daté, responsables d'astreinte, métriques et alertes ; voir `OPERATIONS_RUNBOOK.md` |
| Déploiement | Migrations appliquées, retour arrière testé, gestion des secrets hors arguments et journal de changement |

## Vérification technique à rejouer sur le commit proposé

```bash
pnpm exec next typegen
pnpm lint
pnpm exec tsc --noEmit --incremental false
pnpm test
pnpm test:rls
pnpm test:schema
NEXT_TELEMETRY_DISABLED=1 pnpm build
```

Le test `pnpm test:rls` exerce une base PostgreSQL locale jetable : il vérifie
le refus d'auto-élévation de rôle, l'anonymat des prières, les vidéos masquées,
l'accès Storage, l'écriture dans une salle fermée, les colonnes système de
vidéo et la pause des nouvelles offres, relations, vidéos et dépôts. Il ne
remplace pas une validation sur l'environnement Supabase cible.

## Décision de publication

Avant toute ouverture de publication de contenu, le responsable produit doit consigner :

1. le commit exact et les sorties de validation ;
2. les migrations effectivement appliquées et leur résultat ;
3. les décisions/approbations ci-dessus ;
4. l'autorisation explicite d'ouvrir les fonctionnalités concernées. Le
   déploiement technique du 10 août 2026 est consigné dans `state.md`.
