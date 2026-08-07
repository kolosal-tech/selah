# Décisions techniques — Selah

## Nom
**Selah** (retenu) — pause hébraïque des Psaumes : s'arrêter pour méditer Dieu.
Alternatives écartées : Kairos (temps favorable), Hosanna (« Sauve maintenant »).

## Stack
| Couche | Choix | Pourquoi |
|---|---|---|
| Front + API | Next.js 16.3 (App Router, Server Actions) | un seul codebase, SSR, edge-ready |
| Backend | Supabase (Postgres 17 + RLS, Auth, Realtime, Storage) | scalabilité managée, realtime natif pour prière/compteurs |
| Déploiement | Vercel | build cloud, CDN mondial |
| Mobile | PWA (manifest + standalone) | zéro store au départ ; Expo natif = phase 2 |
| Charge | k6 (smoke/load/stress) | scriptable, seuils bloquants |
| Tests | vitest | logique pure (sabbat, streak) testée |

## Architecture
- **Server Components + Server Actions uniquement** : aucun state client, surface JS minimale, robuste en 2G/3G (mode Lite de fait).
- **RLS partout** : chaque table exposée a ses policies ; aucune table sans RLS.
- **Compteurs dénormalisés** (amen_count, pray_count, comment_count) via triggers SQL — pas de `count(*)` sous charge.
- **Carte d'intercession** = vue SQL agrégée par pays sur 24 h, `security_invoker`, zéro PII.
- **Streak** : fonction SQL `touch_streak` (source de vérité) + miroir TypeScript testé.
- **Mode Sabbat** : `profiles.sabbath_until` ; le layout (app) redirige vers /sabbath tant qu'actif.
- **Traduction IA** : route `/api/translate` à fournisseur branchable (`TRANSLATE_API_URL/KEY`) ; sans config → 501 propre, texte original affiché. Jamais de dégradation muette.
- **Proxy (ex-middleware)** : rafraîchit la session Supabase et protège les routes privées.

## Sécurité
- Charte spirituelle obligatoire à l'inscription (checkbox requise, vérifiée serveur).
- Rôles : membre / leader / pasteur / moderateur / admin (enum SQL).
- Signalements dans `reports`, lisibles uniquement modérateurs/admins.
- Aucun secret dans le code — `.env.example` fourni, `.env*` gitignoré.

## Contraintes rencontrées
- Nouveau projet Supabase = **10 $/mois** (org Pro) → provisionnement suspendu à confirmation
  utilisateur (règle : aucune dépense sans accord). Les 2 projets existants sont des prods
  d'autres applications — exclus.
- Docker absent → pas de Supabase local ; la validation runtime complète se fait
  post-provisionnement.
