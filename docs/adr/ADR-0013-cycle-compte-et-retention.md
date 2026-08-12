# ADR-0013 — Cycle de compte et rétention

## Statut

accepté. 11 août 2026. Cet ADR remplace ADR-0003.

## Contexte

ADR-0003 relevait que l'export de compte et la suppression différée ne sont pas
implémentés, que `private.purge_product_events` est livrée sans planification,
et que les écarts Storage sont seulement détectés par
`docs/MEDIA_RECONCILIATION.md`. ADR-0008 fixe déjà une rétention de 400 jours
pour l'analytique produit. Le PITR Supabase est disponible mais aucune
restauration n'a été exercée ; sa portée sur Storage n'est pas prouvée.

## Décision

Un membre authentifié peut demander un export JSON de ses données. La
suppression est différée de 14 jours et rétractable. Une tâche quotidienne
sur le Vercel déjà utilisé est autorisée, sans nouveau fournisseur payant : elle
purge les objets Storage par API avant la suppression Auth, est idempotente et
émet un reçu sans identifiant utilisateur. La déconnexion ordinaire reste
locale ; la révocation explicite des autres sessions ou de toutes les sessions
est fournie séparément.

L'historique appareil est limité à la famille de navigateur et au type
d'appareil, sans IP ni User-Agent brut, et est conservé 90 jours. MFA et
passkey restent fermés tant qu'un parcours de récupération et de support n'est
pas prêt.

Rétentions retenues : contenu et profil jusqu'à suppression ; analytique
pseudonyme 400 jours conformément à ADR-0008 ; analytique anonyme 400 jours ;
dossier de modération 365 jours après clôture ; sessions 90 jours ; reçus
anonymes 365 jours ; objets Storage orphelins de plus de 24 heures seulement
après réconciliation.

Responsables : le propriétaire produit Selah porte le cycle de compte ;
l'équipe technique porte export, authentification, Cron, purge et RLS ; le rôle
admin traite les incidents et les demandes bloquées.

## Conséquences

L'implémentation doit authentifier l'export et empêcher l'accès aux données
d'un autre compte. La suppression devra préserver la rétractation pendant 14
jours, puis ordonner purge Storage, suppression Auth et nettoyage associé sans
réexécution destructive. Les reçus et journaux opérationnels ne doivent pas
contenir d'identifiant utilisateur. La réconciliation est un prérequis à toute
purge d'orphelin.

Les sauvegardes et le PITR peuvent conserver temporairement des données après
la purge logique ; le délai réel et la portée Storage ne sont pas mesurés. La
suppression effective doit donc être prouvée dans l'environnement cible, sans
supprimer un vrai compte QA durable. L'absence de MFA/passkey limite les
options de sécurité jusqu'à la livraison d'une récupération et d'un support
fiables.

## Réversibilité

La demande de suppression est rétractable seulement pendant 14 jours. Après
purge Storage et suppression Auth, un retour dépend des capacités de backup ou
PITR, non exercées et potentiellement limitées à la base. Les purges sont
idempotentes pour éviter une seconde destruction ; modifier les durées ou
l'ordre de suppression exige un ADR successeur et des migrations compatibles.

## Preuves exigées avant ouverture

1. Tests d'export JSON authentifié, exhaustif pour le compte demandeur et
   négatif pour tout autre compte.
2. Test de suppression QA jetable : demande, rétractation avant J+14, exécution
   quotidienne après J+14, purge Storage avant Auth, idempotence et reçu sans
   identifiant ; aucun compte QA durable ne doit être supprimé.
3. Preuve Vercel Cron de l'exécution quotidienne sur la cible, sans nouveau
   fournisseur payant, et journalisation exploitable sans donnée personnelle.
4. Tests de révocation des autres sessions et de toutes les sessions, et preuve
   que la déconnexion ordinaire reste locale.
5. Tests d'absence d'IP et de User-Agent brut, de purge de l'historique appareil
   à 90 jours et de toutes les durées de rétention décidées.
6. Rapport de réconciliation avant chaque purge d'orphelins de plus de 24 h,
   et essai contrôlé de restauration PITR précisant son périmètre base/Storage.
7. Preuve qu'aucun parcours MFA ou passkey n'est ouvert avant un parcours de
   récupération et support documenté et vérifié.
