# ADR-0011 — Public, âge et mentorat protecteur

## Statut

accepté. 11 août 2026. Cet ADR remplace ADR-0001.

## Contexte

ADR-0001 constatait l'absence de date de naissance, de déclaration d'âge et
de contrôle d'accès lié à l'âge. Il constatait aussi que le flag
`mentorship` de `src/lib/flags.ts` est activé par défaut ; ADR-0009 en décrit
le comportement de configuration. Aucune preuve antérieure d'un arbitrage
détaillé n'a été retrouvée dans la base de connaissances : ce choix est donc
une hypothèse protectrice explicitement retenue, et non un conseil juridique.

## Décision

Les nouvelles inscriptions sont réservées aux personnes de 18 ans ou plus.
Elles doivent fournir une attestation explicite, non précochée et versionnée.
Le produit ne collecte ni date de naissance, ni document d'identité, ni âge
numérique. Les comptes historiques sans attestation conservent les fonctions
communautaires, mais sont exclus du mentorat. Les deux parties d'une relation
de mentorat doivent être attestées ; une relation existante est conservée mais
inaccessible tant que cette condition n'est pas satisfaite.

Le flag `mentorship` devient fail-closed : sans configuration explicitement
valide, le mentorat est fermé. Responsables : le propriétaire produit Selah
porte la politique ; l'équipe technique porte les contrôles RLS et UI ; le
rôle admin traite les incidents.

## Conséquences

L'inscription, le profil et les parcours de mentorat devront stocker seulement
la version et l'horodatage de l'attestation nécessaires à la règle, avec des
contrôles serveur et RLS empêchant tout contournement. Le produit doit rendre
le refus et l'inaccessibilité compréhensibles sans exposer de donnée d'âge.
Les relations existantes ne sont ni détruites ni rendues actives par défaut.

Cette décision réduit la collecte mais n'établit pas l'âge réel d'une personne
et ne remplace pas une analyse juridique par territoire. Une configuration
omise ferme le mentorat, ce qui peut interrompre temporairement ce parcours.

## Réversibilité

Le retour au mentorat fermé est réversible par configuration, après
redéploiement tel que décrit dans ADR-0009. Passer à une autre règle d'âge ou
à une vérification documentaire exige un ADR successeur, des migrations et
une reprise de données ; aucune donnée de naissance ou document ne doit être
créé rétroactivement par ce retour.

## Preuves exigées avant ouverture

1. Migration et tests RLS prouvant qu'une attestation versionnée est requise
   pour chaque partie avant création, lecture ou usage d'un mentorat.
2. Tests UI et d'inscription prouvant que la case n'est pas précochée, que la
   version est enregistrée et qu'aucune date, document ou âge numérique n'est
   demandé ou envoyé.
3. Test de configuration prouvant que le mentorat est fermé sans valeur
   explicitement valide, puis preuve de la valeur de production.
4. Test de conservation des relations existantes et de leur inaccessibilité
   tant qu'une des attestations manque.
5. Propriétaire produit Selah, équipe technique et rôle admin nommés dans le
   runbook d'exploitation, avec procédure d'incident vérifiée.
