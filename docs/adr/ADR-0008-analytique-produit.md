# ADR-0008 — Analytique produit : pseudonymat assumé et limites

## Statut

Accepté — 11 août 2026 — équipe technique. La collecte reste fermée par
défaut : le flag `analytics` de `src/lib/flags.ts` vaut `false` sans
`SELAH_FLAG_ANALYTICS`, et un flag n'agit qu'après redéploiement Vercel.

## Contexte

Aucune mesure produit n'existait avant cette décision. Combien de comptes
créés publient une première fois, combien reviennent à J1, J7 et J30 : ces
chiffres ne sont pas mesurés aujourd'hui. Compter un retour suppose de
relier deux visites au même compte, donc de
stocker un identifiant d'acteur. `actor_id` est une donnée pseudonyme au sens
du RGPD : elle ne porte pas le nom de la personne, mais reste rattachable à
un compte. La tension est assumée plutôt que masquée. Seconde contrainte :
l'application ne détient pas de clé `service_role`, toute écriture se fait
avec la session de l'appelant.

## Décision

La migration `supabase/migrations/20260811120000_product_analytics.sql` crée
`public.product_events`, la RPC `public.record_product_event` et la vue
`public.product_events_daily`. Les contreparties sont portées par le schéma,
pas par une convention d'équipe :

- Toutes les dimensions sont des types énumérés fermés. Sans colonne libre,
  écrire ici une prière ou une adresse e-mail est impossible.
- RLS activée, policies `select` et `insert` en `using (false)` et
  `with check (false)`, plus `revoke all` sur `anon` et `authenticated`.
- L'écriture passe uniquement par la RPC, qui attribue l'acteur via
  `auth.uid()`. L'appelant ne choisit pas l'identifiant enregistré.
- `on delete cascade` depuis `public.profiles` : supprimer un profil emporte
  ses événements. Restitution agrégée, réservée aux rôles de modération.
- `private.purge_product_events` livrée mais non planifiée : pas de `pg_cron`.

## Conséquences

Sont mesurables : première publication, première prière, première vue du
fil, ouverture de salle, refus d'action, retour d'un compte existant. Ne le
sont pas, et sortent du périmètre de la vague 0 : les échecs de connexion,
les échecs d'inscription, les abandons de visiteurs anonymes.

Ces trois événements se produisent avant qu'une session existe, donc sans
`auth.uid()`. Les instrumenter demanderait soit une clé `service_role` dans
l'application, soit l'ouverture de la RPC au rôle `anon`. La seconde option
rendrait chaque événement forgeable par n'importe quel appelant : le compteur
cesserait d'être une mesure. Aucune des deux n'est retenue ici.

Autres limites : la rétention de 400 jours n'est pas appliquée tant que la
purge n'est pas planifiée ; la mention d'information et le registre de
traitement ne sont pas rédigés, non décidé ; le responsable est à nommer.

## Réversibilité

Le retrait est total et tient dans un script, non exécuté à ce jour. Il
supprime les quatre fonctions de la migration : deux pour l'écriture, une
pour la restitution, une pour la purge. Poser `SELAH_FLAG_ANALYTICS=false`
coupe la collecte côté application sans toucher au schéma, après
redéploiement.

```sql
drop view if exists public.product_events_daily;
drop function if exists private.product_events_daily_rows();
drop function if exists public.record_product_event(text, text, text, text);
drop function if exists private.record_product_event_impl(
  text, text, text, text);
drop function if exists private.purge_product_events(integer);
drop table if exists public.product_events;
drop type if exists public.product_event_reason;
drop type if exists public.product_event_outcome;
drop type if exists public.product_event_surface;
drop type if exists public.product_event_name;
```

## Preuves exigées avant ouverture

1. Migration listée comme appliquée sur le projet Supabase cible, sortie
   copiée dans la revue.
2. Session `authenticated` : zéro ligne en `select` direct sur
   `public.product_events`, refus en `insert`. Compte de rôle `membre` :
   aucune ligne de `public.product_events_daily`.
3. Écriture par la RPC vérifiée — la ligne créée porte l'`actor_id` de
   l'appelant, non une valeur fournie en paramètre.
4. Suppression d'un profil de test : ses événements ont disparu.
   `private.purge_product_events` exécutée une fois manuellement, avec le
   nombre de lignes retourné.
5. Mention d'information rédigée et publiée, responsable du traitement
   nommé. Non fait à ce jour.
