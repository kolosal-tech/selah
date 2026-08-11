# Index des décisions d'architecture

Ce dossier contient les ADR du projet Selah. Un ADR consigne une décision
d'architecture : son contexte, le choix retenu, ses conséquences et le coût
d'un retour arrière.

## Ce qu'est un ADR ici

Un ADR est un enregistrement daté d'un état de connaissance. Il n'est pas un
document vivant. Une fois écrit, son contenu n'est plus modifié : on ne
réécrit pas l'histoire d'une décision, on la remplace.

Cette immuabilité a une raison pratique. Relire un ADR doit permettre de
comprendre pourquoi une décision a paru juste au moment où elle a été prise,
avec les informations disponibles à cet instant. Un ADR corrigé après coup
efface cette trace et rend la relecture trompeuse.

Deux exceptions, et seulement deux : la correction d'une faute de frappe, et
le passage du champ Statut à « remplacé » avec le renvoi vers l'ADR
successeur. Tout le reste passe par un nouvel ADR.

## Statuts

La liste est fermée. Aucun autre statut n'est admis.

- **proposé** — l'ADR est rédigé, la décision n'est pas prise. Les preuves
  exigées ne sont pas toutes réunies.
- **accepté** — la décision est prise et fait autorité sur le code.
- **bloqué — décision non technique** — l'analyse technique est faite, mais
  le choix dépend d'un arbitrage hors du périmètre technique : budget,
  responsabilité, engagement juridique, personne à nommer. L'ADR décrit alors
  ce qui manque exactement pour trancher.
- **remplacé** — un ADR ultérieur porte la décision. L'ADR remplacé reste en
  place, inchangé, avec le renvoi vers son successeur.

## Liste des ADR

| Numéro | Sujet | Statut |
|---|---|---|
| [ADR-0001](ADR-0001-public-et-age.md) | Public admis et âge minimal | bloqué — décision non technique |
| [ADR-0002](ADR-0002-moderation.md) | Modération : taxonomie, rôles, délais, sanctions et appels | bloqué — décision non technique |
| [ADR-0003](ADR-0003-retention-donnees.md) | Rétention des données et effacement | proposé |
| [ADR-0004](ADR-0004-droits-media.md) | Droits média : provenance, consentement image et voix, retrait | bloqué — décision non technique |
| [ADR-0005](ADR-0005-fournisseurs.md) | Fournisseurs : critères d'admission et sortie de secours | accepté (grille) — choix bloqués |
| [ADR-0006](ADR-0006-paiement.md) | Paiement et entitlements | bloqué — décision non technique |
| [ADR-0007](ADR-0007-philosophie-du-classement.md) | Philosophie du classement du fil | proposé |
| [ADR-0008](ADR-0008-analytique-produit.md) | Analytique produit : `product_events`, RLS deny-all et RPC d'écriture | accepté |
| [ADR-0009](ADR-0009-feature-flags.md) | Feature flags par variable d'environnement | accepté |

ADR-0005 est accepté en tant que grille : la méthode d'évaluation fait
autorité. Les choix qu'elle sert à instruire restent bloqués tant que les
arbitrages non techniques correspondants ne sont pas rendus.

## Rubriques obligatoires

Tout ADR comporte ces six rubriques, dans cet ordre, sans en omettre aucune.
Une rubrique sans contenu s'écrit « non décidé » ou « non mesuré », jamais
vide.

1. **Statut** — une valeur de la liste fermée ci-dessus. Si le statut est
   « bloqué — décision non technique », nommer l'arbitrage attendu. Si le
   statut est « remplacé », renvoyer vers l'ADR successeur.
2. **Contexte** — l'état vérifié au moment de la rédaction : ce que fait le
   code, ce qui est mesuré, ce qui ne l'est pas. Chaque affirmation renvoie à
   un fichier, une migration ou une mesure. Une information absente s'écrit
   « non mesuré » avec la preuve qui manque.
3. **Décision** — ce qui est retenu, formulé de façon vérifiable. Si rien
   n'est retenu, écrire « non décidé » et dire ce qui bloque.
4. **Conséquences** — ce que la décision entraîne : sur le code, sur les
   données, sur l'exploitation, sur le coût. Les conséquences défavorables
   sont écrites au même titre que les autres.
5. **Réversibilité** — le coût du retour arrière : migration à écrire,
   données à reprendre, contrat externe à dénoncer, temps d'indisponibilité.
   Si le retour arrière est impossible, l'écrire.
6. **Preuves exigées avant ouverture** — la liste des mesures, tests ou
   arbitrages à produire avant que le statut puisse passer à « accepté ».
   Chaque élément est vérifiable : une commande, une requête, un document
   signé. Une preuve non produite reste dans la liste.

## Remplacement d'un ADR accepté

Une vague de travail qui contredit un ADR accepté commence par écrire l'ADR
qui le remplace. L'ordre n'est pas négociable : l'ADR successeur est rédigé
et accepté avant que le code diverge.

Un code qui contredit un ADR accepté sans ADR successeur est un écart, pas
une évolution. Le premier correctif est alors documentaire : soit le code
revient à la décision, soit l'ADR successeur est écrit.

Le successeur reprend les six rubriques et indique dans son Contexte quel
ADR il remplace et pourquoi. L'ADR remplacé passe au statut « remplacé » et
reçoit le renvoi. Son corps reste inchangé.
