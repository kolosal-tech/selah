# ADR-0001 — Public admis et âge minimal

## Statut

bloqué — décision non technique. 11 août 2026. Décideur : à nommer
(produit et juridique). L'équipe technique n'a pas qualité pour trancher
l'âge d'accès à un service en ligne.

## Contexte

Selah est en production sur https://selah-wheat.vercel.app. Le produit
n'a aujourd'hui aucune notion d'âge : aucun champ de date de naissance,
aucune déclaration à l'inscription, aucun contrôle d'accès dérivé de
l'âge. Recherche de `birth`, `naissance`, `age`, `majeur`, `mineur` dans
`supabase/migrations/` et `src/lib/` : une seule occurrence, dans un
commentaire de `supabase/migrations/0015_safety_default_pause.sql`.

Cette migration 0015 avait suspendu le mentorat et le dépôt média, avec
le motif écrit dans son en-tête : garde-fous « avant cadrage
mineurs/mentorat et pipeline média ». La suspension a ensuite été levée
par la migration 0016, puis le pilotage est passé aux flags
(`src/lib/flags.ts`). Le flag `mentorship` vaut `true` par défaut.

Conséquence à énoncer franchement : la mise en relation 1-to-1 entre un
mentor et un membre est ouverte en production alors que le cadre mineurs
qui conditionnait sa réouverture n'a jamais été décidé. Le mentorat est
la fonctionnalité la plus exposée du produit sur ce point, devant les
rooms audio (WebRTC mesh, 4 pairs, mute pair-à-pair non autoritaire) et
la publication vidéo (dépôt direct, sans état de quarantaine ni
validation d'octets côté serveur).

## Décision

Aucune décision n'est prise. Deux options sont mises en forme, à
arbitrer par la personne à nommer.

Option A — majeurs uniquement. Un âge minimal déclaré conditionne la
création de compte. Techniquement : un champ d'âge sur `profiles`
(date de naissance ou attestation de majorité), une vérification à
l'inscription, une charte mentionnant l'exclusion des mineurs. Le
contrôle d'accès reste global : aucun parcours différencié. Le mentorat
peut rester ouvert tel quel.

Option B — mineurs admis sous cadre. Techniquement plus lourd :
consentement d'un titulaire de l'autorité parentale, méthode de
vérification d'âge (non choisie), supervision des échanges privés,
canal d'urgence et procédure de signalement avec un responsable
d'astreinte, restriction ou interdiction du mentorat 1-to-1 entre un
adulte et un mineur, et durée de conservation des preuves de
consentement. Aucun de ces éléments n'existe dans le code.

Le choix du fournisseur de vérification d'âge, le coût, l'âge minimal
retenu et la juridiction de référence sont non décidés.

## Conséquences

Tant que la décision manque, le produit accepte de fait des comptes
d'âge inconnu et leur ouvre le mentorat. C'est un écart assumé et non
mesuré : la part de mineurs inscrits est inconnue, faute de champ d'âge.

Repli proposé, à valider par la même personne : fermer le mentorat en
posant `SELAH_FLAG_MENTORSHIP=0` sur Vercel, puis redéployer. La
variable n'agit qu'après redéploiement. Ce repli ne ferme que les
parcours protégés par le flag ; il ne rétablit pas les révocations SQL
de la migration 0015.

Toute option retenue impose ensuite une migration ajoutant le champ
d'âge, une reprise du parcours d'inscription et une mise à jour de la
charte signée.

## Réversibilité

Fermer le flag `mentorship` est réversible : une variable et un
redéploiement, sans migration ni perte de données.

Ajouter un champ d'âge est réversible côté schéma, mais la collecte de
dates de naissance ne l'est pas : la donnée collectée devra être purgée
explicitement si l'option change.

Appliquer l'option A après coup n'est pas réversible pour les comptes
existants exclus. Aucune procédure de restauration n'a été exercée sur
ce projet, PITR Supabase compris.

## Preuves exigées avant ouverture

1. Nom du décideur produit et du décideur juridique, écrits dans cet
   ADR remplaçant.
2. Âge minimal retenu et juridiction de référence.
3. Pour l'option B : fournisseur ou méthode de vérification d'âge,
   avec son coût et son temps d'intégration estimés.
4. Pour l'option B : responsable d'astreinte nommé pour le canal
   d'urgence, et délai de réponse cible. La colonne « responsable » de
   `docs/OPERATIONS_RUNBOOK.md` doit être renseignée.
5. Migration appliquée ajoutant le champ d'âge, avec sa sortie de
   `pnpm test:schema` et de `pnpm test:rls`.
6. Test RLS prouvant qu'un compte sans âge renseigné ne peut ni créer
   une offre de mentorat ni entrer dans une mise en relation.
7. Décision écrite sur le mentorat 1-to-1 adulte/mineur, et valeur du
   flag `mentorship` en production après cette décision.
