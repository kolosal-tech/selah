# ADR-0005 — Fournisseurs : critères d'admission et sortie de secours

## Statut

Accepté le 11 août 2026 par l'équipe technique, pour la grille d'admission
seule. L'admission d'un fournisseur reste bloquée — décision non technique.
Décideur de l'admission : à nommer.

## Contexte

Trois fournisseurs sont en service.

- Supabase : base Postgres, authentification, stockage, temps réel.
  31 migrations SQL versionnées. PITR disponible, jamais exercé.
- Vercel : hébergement et Runtime Logs, seule source de corrélation
  serveur aujourd'hui.
- Un service de traduction joint via `TRANSLATE_API_URL`. Fournisseur,
  région de traitement et contrat : non décidés dans ce dépôt.

Trois besoins sont identifiés sans fournisseur retenu.

- TURN/SFU audio. `src/app/(app)/rooms/[id]/room-audio.tsx` implémente un
  mesh WebRTC limité à 4 pairs, `iceServers` vide : ni TURN ni STUN. Le
  mute est P2P, donc non autoritaire.
- Antivirus et transcodage média. La publication est directe : aucun état
  `quarantined` ni `processing`, aucune validation des octets côté
  serveur. Contrôles existants : chemin Storage (regex uid/nom) et
  `duration_s <= 300`.
- Télémétrie d'erreur. Aucune. Aucun RUM non plus : LCP, INP et CLS
  terrain sont non mesurés.

Aucun engagement payant ne peut être pris sans autorisation explicite.

## Décision

Un fournisseur n'est admis que si ces six lignes sont renseignées par des
valeurs vérifiées auprès du fournisseur, non estimées.

1. Région de traitement : pays d'hébergement, sous-traitants, transferts
   hors Union européenne.
2. DPA : contrat de sous-traitance signé, durée de conservation, procédure
   de suppression sur demande.
3. Coût par unité : unité facturée, prix unitaire, palier suivant, coût au
   volume actuel et à dix fois ce volume.
4. Quota : plafond, comportement à la limite (rejet, file, facturation),
   délai de relèvement.
5. Portabilité : export complet des données dans un format ouvert, délai
   d'obtention, réimport testé ailleurs.
6. Sortie de secours : remplaçant identifié, durée de bascule, données
   perdues pendant la bascule, procédure écrite.

La grille s'applique aussi aux trois fournisseurs déjà en service. Leurs
fiches sont non renseignées à ce jour.

## Conséquences

- Les salles audio restent plafonnées à 4 pairs, sans relais. Les pairs
  derrière un NAT restrictif peuvent ne pas se connecter : non mesuré.
- Le média reste publié sans analyse d'octets. Le risque de fichier
  hostile est assumé et non couvert.
- Sans télémétrie, le délai de détection d'une erreur utilisateur est
  inconnu ; le diagnostic reste limité aux Runtime Logs Vercel.
- La traduction dépend d'un service dont la région de traitement est non
  décidée. Le comportement en cas d'indisponibilité n'est pas documenté.
- Aucun coût nouveau n'est engagé par cet ADR.

## Réversibilité

- Supabase : schéma reconstructible depuis les 31 migrations. Le coût de
  sortie porte sur l'authentification, le stockage, le temps réel et les
  politiques RLS ; il est non mesuré.
- Vercel : projet Next.js standard ; aucun déploiement ailleurs vérifié.
- Traduction : le service est derrière une seule variable d'environnement,
  donc remplaçable par changement de valeur. Aucun test de bascule exécuté.
- Un fournisseur admis sans le critère 6 renseigné est un fournisseur non
  réversible ; cet ADR l'interdit.

## Preuves exigées avant ouverture

- Une fiche par fournisseur, datée, couvrant les six critères, chaque
  valeur accompagnée de sa source.
- TURN/SFU : essai de connexion depuis deux réseaux distincts, avec le
  taux de connexion établie et la latence observée.
- Antivirus et transcodage : un fichier de test refusé, l'entrée de
  journal correspondante, et le comportement du client sur ce refus.
- Télémétrie : une erreur provoquée volontairement, remontée dans l'outil
  et corrélée à une requête serveur.
- Base : une restauration PITR exercée sur une copie, avec sa durée, avant
  toute migration touchant au fournisseur de base.
- Autorisation écrite de dépense pour tout fournisseur payant, par le
  décideur à nommer.
