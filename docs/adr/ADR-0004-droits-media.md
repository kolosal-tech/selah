# ADR-0004 — Droits média : provenance, consentement image et voix, retrait

## Statut

Bloqué — décision non technique. 11 août 2026. Décideur : à nommer.

La décision porte sur des engagements juridiques et éditoriaux. Elle ne peut
pas être prise par l'équipe technique.

## Contexte

Selah accepte la publication de vidéos par les membres. Le pipeline média
publie directement : aucun état `quarantined` ni `processing`, aucune
validation des octets ni analyse antivirus côté serveur. La validation se
limite au chemin Storage (expression régulière `uid`/nom de fichier) et à la
durée `duration_s <= 300`.

Il n'existe aujourd'hui aucune capture de consentement. Le produit ne demande
pas au déposant s'il détient les droits sur ce qu'il publie, ne recueille pas
l'accord des personnes filmées ou enregistrées, et ne conserve aucune trace
opposable d'un tel accord.

Les rooms audio n'enregistrent pas. Le transport est un maillage WebRTC limité
à quatre pairs, `iceServers` vide, sans SFU ni serveur d'enregistrement dans
`src/app/(app)/rooms/[id]/room-audio.tsx`. Aucun consentement d'enregistrement
n'est donc requis en l'état.

Aucune procédure de retrait n'est décidée : ni point d'entrée pour une
réclamation, ni délai de traitement, ni responsable, ni trace conservée après
suppression. Le drapeau `video_publication` (`SELAH_FLAG_VIDEO_PUBLICATION`,
défaut `true`) coupe la publication, mais n'agit qu'après redéploiement.

## Décision

Aucune décision n'est prise. Cet ADR enregistre le blocage et le périmètre à
trancher. Quatre points restent ouverts :

1. Déclaration de provenance : ce que le déposant affirme au dépôt, et si
   cette affirmation est stockée avec le média.
2. Consentement image et voix des tiers apparaissant dans un média : forme,
   preuve conservée, durée de conservation.
3. Procédure de retrait : canal de réclamation, délai cible, responsable,
   effet sur les copies Storage et sur les lignes en base.
4. Rétroactivité : traitement des médias déjà publiés avant la mise en place
   d'une capture de consentement.

Point non ouvert à ce stade : le consentement d'enregistrement des rooms.
Il devient obligatoire, et préalable à toute activation, le jour où une
fonction d'enregistrement audio est envisagée.

## Conséquences

Tant que le blocage dure :

- Toute réclamation de droits reçue est traitée hors produit, sans procédure
  écrite ni délai annoncé. Le risque porte sur le retard de traitement.
- Le seul levier immédiat est la coupure de `SELAH_FLAG_VIDEO_PUBLICATION`,
  qui suspend toute publication vidéo et exige un redéploiement.
- Aucune communication publique ne doit affirmer qu'un consentement est
  recueilli, ni qu'une procédure de retrait existe.
- Le volume de médias publiés sans déclaration de provenance augmente, et
  avec lui le coût d'une reprise rétroactive.

## Réversibilité

Une capture de consentement est ajoutable sans rupture : nouvelle migration
SQL, colonnes et table dédiées, écriture au dépôt. Le corpus antérieur reste
non couvert, ce qui impose soit une campagne de régularisation, soit une
règle explicite de non-rétroactivité.

Le retrait d'un média est irréversible une fois l'objet Storage supprimé.
La sauvegarde disponible est le PITR Supabase, jamais exercé sur ce projet ;
il couvre la base, pas nécessairement les objets Storage. Préférer un masquage
réversible tant que la portée du PITR sur Storage n'est pas vérifiée.

## Preuves exigées avant ouverture

Le blocage ne sera levé qu'avec, réunies :

- Un texte de déclaration de provenance validé par le décideur à nommer, et
  la liste des champs stockés avec le média.
- Un canal de réclamation nommé (adresse ou formulaire), avec un responsable
  à nommer et un délai cible chiffré.
- Une migration SQL appliquée, listée par `list_migrations`, créant le
  stockage du consentement avec RLS vérifiée par `pnpm test:rls`.
- Un test bout en bout démontrant qu'un dépôt sans déclaration est refusé,
  sortie exacte à joindre.
- Une restauration PITR exercée au moins une fois, avec la portée réelle sur
  Storage constatée et écrite.
- Une décision écrite sur la rétroactivité du corpus déjà publié.
