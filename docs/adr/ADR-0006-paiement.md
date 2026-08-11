# ADR-0006 — Paiement et entitlements

## Statut

Bloqué — décision non technique. 11 août 2026. Décideur : à nommer.

Le blocage porte sur la revue juridique, les conditions générales de
vente, la politique de remboursement et l'autorisation de débit. Tant
que ces quatre points ne sont pas écrits, aucun code n'est écrit.

## Contexte

Rien n'est implémenté. Le dépôt ne contient aucun fournisseur de
paiement, aucune table d'abonnement, aucun webhook. Les 31 migrations
SQL de `supabase/migrations/` ne créent aucun objet de facturation. Les
rôles existants sont administratifs, pas commerciaux.

Selah est un réseau chrétien francophone : un paiement touche la
confiance avant la technique. Par ailleurs, la production sur
`https://selah-wheat.vercel.app` n'a aucune télémétrie d'erreur, la
corrélation passant par les Vercel Runtime Logs seuls : un flux de
paiement ajouté dans cet état aurait des échecs non observables.

## Décision

Poser le principe avant l'outil. Le prestataire n'est pas choisi ici :
non décidé.

1. Moteur d'entitlements indépendant du fournisseur. Les droits d'un
   compte se lisent dans une table interne alimentée par un adaptateur,
   seul élément à remplacer en cas de changement de prestataire.
2. Aucun droit accordé depuis le client. Un entitlement s'écrit
   exclusivement côté serveur, sous RLS deny-all, par une fonction
   dédiée. Le client lit son état, il ne l'écrit pas.
3. Webhooks signés et idempotents. Signature vérifiée avant lecture du
   corps ; identifiant d'événement en clé unique, donc un rejeu reste
   sans effet. L'ordre d'arrivée n'est jamais supposé.
4. Bac à sable uniquement. Aucune clé de production configurée, aucun
   débit réel possible tant que ce statut n'a pas changé.

Principes produit non négociables, indépendants de toute décision
commerciale :

- Prier est gratuit : publier une intention, prier pour autrui,
  rejoindre un temps de prière.
- Écouter est gratuit : le contenu publié reste accessible sans achat.
- Se protéger est gratuit : signaler, bloquer, demander une modération,
  exporter ou supprimer ses données.
- Aucune promesse spirituelle liée à un achat. Aucun libellé ne suggère
  qu'un paiement produit une bénédiction, une faveur ou une priorité
  devant Dieu. Aucun classement ni badge ne s'achète.

## Conséquences

Le moteur ajoute une table et une surface RLS à tester : `pnpm test:rls`
devra couvrir l'écriture refusée depuis un client authentifié.
L'indépendance au fournisseur coûte un adaptateur, prix d'une sortie
sans réécriture du produit. Le périmètre gratuit réduit l'assiette
monétisable : choix assumé. Aucun prix ni palier ici : non décidé.

## Réversibilité

Élevée tant que rien n'est implémenté : le retrait consiste à ne pas
commencer. Après implémentation, elle reste bonne côté fournisseur grâce
à l'adaptateur, et faible côté utilisateur : un droit retiré est une
régression visible, d'où une désactivation datée plutôt qu'un `delete`.
Le PITR Supabase est disponible mais jamais exercé ; cet exercice est un
préalable à toute donnée de facturation en base.

## Preuves exigées avant ouverture

Aucune de ces preuves n'existe à ce jour.

1. Revue juridique écrite et datée, responsable à nommer, couvrant le
   statut de l'encaissement et la nature des sommes perçues.
2. Conditions générales de vente publiées, versionnées et datées, avec
   point d'entrée depuis l'application.
3. Politique de remboursement écrite : délai, canal, décideur, trace.
4. Autorisation de débit formalisée : qui autorise, sur quel compte,
   avec quelle limite.
5. Fournisseur choisi et consigné dans un ADR remplaçant celui-ci.
6. Test de bout en bout en bac à sable, journalisé : paiement accepté,
   refusé, webhook rejoué deux fois, signature invalide rejetée.
7. Sortie de test prouvant le refus d'écriture d'un entitlement depuis
   un client authentifié.
8. Télémétrie d'erreur sur le parcours de paiement, avec une trace
   corrélée entre client et serveur.
9. Exercice de restauration PITR réalisé et daté.
10. Responsable d'astreinte des incidents de paiement : à nommer.
    Aucune ligne de `docs/OPERATIONS_RUNBOOK.md` ne porte de responsable.
