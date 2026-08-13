# ADR-0014 — Frein d'entrée sur les parcours non authentifiés

## Statut

Accepté — 14 août 2026 — équipe technique. Le frein est actif par défaut ;
il ne dépend d'aucun fournisseur payant et n'introduit aucune donnée nouvelle
lisible.

## Contexte

`consume_rate_limit` (migration `0012`) exige `auth.uid()`, nul avant
authentification. Les trois parcours d'entrée — `login`, `signup` et la
demande de réinitialisation — appelaient donc Supabase Auth sans aucun frein
applicatif. Le seul garde-fou était celui du fournisseur.

Cette absence a produit un incident observable le 13 août 2026 : une demande de
réinitialisation répétée a atteint `over_email_send_rate_limit`, le plafond de
deux e-mails par heure du fournisseur intégré Supabase. L'écran affichait un
message générique, et le compte visé se retrouvait privé de réinitialisation
sans qu'aucune trace locale n'explique pourquoi. Le quota d'e-mails est partagé
par tout le projet : quelques demandes suffisent à en priver tout le monde.

`docs/IMPLEMENTATION_STATUS.md` porte cette lacune sous la référence F-017
(« anti-abus : entrée Auth et upload direct restent à protéger »).

Contrainte de conception : l'entrée doit être freinée sans que la base
n'apprenne qui se connecte depuis où. Un journal de tentatives indexé par
adresse serait précisément le fichier que la minimisation interdit.

## Décision

Un compteur par couple (empreinte d'adresse, portée), dans
`private.auth_throttle`, alimenté par `public.consume_auth_attempt`.

Quatre propriétés portent la décision.

**L'adresse n'entre jamais en base.** L'application calcule
`sha256(adresse + ':' + secret)` et ne transmet que ce condensé. Le poivre est
`SELAH_ANALYTICS_TOKEN`, déjà détenu côté serveur seul. Un SHA-256 nu ne
protégerait rien — l'espace IPv4 s'épuise en force brute — c'est le poivre qui
rend le condensé irréversible pour qui lit la base.

**La table vit hors du schéma exposé.** `private` n'est pas publié par
PostgREST, et le wrapper public reste `SECURITY INVOKER`, l'élévation restant
dans `private` — même motif que `consume_rate_limit` et
`record_anonymous_event`, et même raison : aucune fonction élevée joignable
depuis l'API REST.

**Les fenêtres périmées s'effacent.** `private.purge_auth_throttle()` supprime
tout ce qui dépasse deux heures. Sans elle, la table deviendrait l'historique
de connexions que cette décision refuse de créer.

**Le frein est ouvert en cas de panne.** Sans secret serveur, sans adresse
lisible, ou si la base refuse, la tentative passe. Un anti-abus qui bloquerait
l'authentification pendant un incident transformerait une gêne en
indisponibilité totale. La RLS et Supabase Auth restent les garde-fous durs ;
celui-ci est un amortisseur.

Plafonds retenus : `login` douze tentatives par quart d'heure, `signup` cinq
par heure, `password_reset` trois par heure. Ils arrêtent l'automatisation sans
gêner la personne qui se trompe deux fois de mot de passe. Les deux derniers
sont plus stricts parce qu'ils consomment le quota d'e-mails du projet.

## Conséquences

Un utilisateur derrière un NAT partagé — entreprise, université, opérateur
mobile — partage son empreinte avec ses voisins. Le plafond `login` a été fixé
à douze pour cette raison ; il reste possible qu'un usage collectif intense
déclenche un refus temporaire. Le message d'erreur le dit et invite à
réessayer, sans jamais indiquer si le compte existe.

Le frein ne remplace pas un SMTP dédié. Il évite d'épuiser le quota par
accident ou par abus ; il ne l'augmente pas. Le choix d'un fournisseur SMTP
reste ouvert (ADR-0005) et reste la seule réponse au plafond lui-même.

Le poivre est partagé avec la voie anonyme. Sa rotation invalide simultanément
les compteurs en cours — effet acceptable, les fenêtres durant au plus une
heure — mais elle doit être faite en connaissance de cause.

## Réversibilité

Retirer les trois appels à `consumeAuthAttempt` suffit à désactiver le frein
sans migration : la table cesse d'être alimentée et se purge d'elle-même. Le
retrait complet est `drop function public.consume_auth_attempt`,
`drop function private.consume_auth_attempt_impl`,
`drop function private.purge_auth_throttle`, `drop table private.auth_throttle`.
Aucune donnée applicative n'en dépend.

## Preuves exigées avant ouverture

1. `tests/auth-throttle-rls.sql` vert dans `pnpm test:schema` : table
   inatteignable, jeton absent/faux refusé, condensé mal formé refusé, portée
   inconnue refusée, quatrième réinitialisation refusée, compteurs indépendants
   par portée et par adresse, purge respectant les fenêtres courantes.
2. Vérification distante que `private.auth_throttle` n'est exposée ni à `anon`
   ni à `authenticated`, et que Security Advisor ne signale aucune fonction
   élevée dans le schéma public.
3. Un parcours réel de connexion refusée en production affiche le message
   dédié sans révéler l'existence du compte.
4. Planification de `private.purge_auth_throttle()` — non faite : `pg_cron`
   n'est pas installé, c'est une décision d'exploitation (ADR-0003). En son
   absence, la table reste bornée par le faible volume des fenêtres actives.
