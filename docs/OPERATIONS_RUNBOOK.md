# Runbook d’exploitation à valider

Ce runbook prépare l’exploitation ; les noms de responsables, fournisseur,
RPO/RTO et canaux d’alerte doivent être approuvés avant toute publication.

## Contrôle avant changement

1. Consigner le commit exact, les migrations ciblées et une fenêtre de retour.
2. Rejouer les validations locales :

   ```bash
   pnpm exec next typegen
   pnpm lint
   pnpm exec tsc --noEmit --incremental false
   pnpm test
   pnpm test:rls
   pnpm test:schema
   NEXT_TELEMETRY_DISABLED=1 pnpm build
   ```

3. Vérifier que les migrations attendues sont applicables sur une copie de
   données autorisée et que le plan de retour ne requiert pas de suppression
   irréversible.
4. Obtenir l’autorisation explicite de publication.

## Signaux à brancher

Les seuils ci-dessous sont chiffrés dans `SLO.md` ; ils y sont marqués « à
valider » tant qu'un responsable n'est pas nommé. Un seuil sans propriétaire
reste un seuil : il permet de décider s'il faut agir, pas de savoir qui agit.
Aucune alerte automatique n'existe aujourd'hui — la détection est manuelle,
par lecture des Vercel Runtime Logs.

| Signal | Seuil | Responsable | Première action |
|---|---|---|---|
| Erreurs Auth / inscription | > 1 % des tentatives sur 15 min | à nommer | Vérifier fournisseur, statut et limitation d’entrée |
| Erreurs upload / objets orphelins | > 20 objets sans ligne, ou 2 échecs consécutifs | à nommer | Consulter les vues de réconciliation, ne rien purger sans examen |
| Signalements ouverts / décisions | > 24 h sans décision sur un signalement | à nommer | Qualifier dans le processus de modération validé |
| Erreurs traduction / quota | 429 du fournisseur, ou quota à 80 % | à nommer | Vérifier le fournisseur et le budget, ne pas journaliser le texte |
| Latence serveur | p95 > 1 500 ms sur 10 min | à nommer | Comparer au déploiement courant, envisager un retour arrière |
| Réponses 5xx | une seule sur la fenêtre observée | à nommer | Lire les logs du déploiement, corréler au SHA servi |
| Volume d'événements produit | > 60 lignes/minute pour un acteur | à nommer | Le plafond en base a déjà refusé l'excédent ; chercher la boucle appelante |
| Sauvegarde / restauration | RPO 24 h, RTO 4 h (à valider) | à nommer | Ouvrir incident si le dernier exercice est expiré |

## Restauration

Une restauration n’est considérée comme testée que si un exercice daté prouve :

1. une sauvegarde chiffrée et son périmètre ;
2. la restauration sur environnement isolé ;
3. les migrations compatibles avec cette copie ;
4. une connexion, lecture/écriture RLS et accès média vérifiés ;
5. le délai mesuré et le responsable ayant validé le résultat.

## Incident média ou sécurité

1. Préserver le contexte et l’identifiant de contenu ; ne pas exposer de
   données de prière ou de compte dans un ticket non autorisé.
2. Appliquer la procédure de modération validée ; le masquage vidéo est
   journalisé par la base.
3. Examiner `video_storage_orphans` et `video_storage_missing` avant toute
   purge. Les objets récents doivent être exclus de l’action.
4. Consigner décision, acteur, heure, portée et vérification post-action.

## Revue périodique à décider

- fréquence de la réconciliation média ;
- exercice de restauration ;
- rotation des secrets et revue des accès ;
- revue des quotas et de leur impact ;
- revue des décisions de modération et éventuels appels.
