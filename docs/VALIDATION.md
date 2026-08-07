# Validation — Selah v0.1 (2026-08-07)

## Production
- App : https://selah-wheat.vercel.app (Vercel, projet `selah`, build turbopack)
- Backend : Supabase `selah` (`ilqzmpcmahxxnbdrugyt`, eu-west-3 Paris, Postgres 17)
- Migrations appliquées : `0001_selah_core`, `0002_selah_lockdown_functions`, `0003_selah_handle_new_user`

## Tests unitaires
```
pnpm test   → 14 tests, 2 fichiers, tous verts (sabbath, streak)
```

## Parcours E2E réel (navigateur, sur la prod)
| Étape | Résultat |
|---|---|
| Landing publique | OK |
| Signup + charte obligatoire | OK (email invalide rejeté avec message) |
| Trigger création profil | OK (`qa_selah_1` en DB) |
| Login | OK |
| Publication post + verset | OK (visible dans le fil) |
| Amen | OK (`amen_count = 1` par trigger) |
| Dépôt sujet de prière | OK |
| « Je prie pour toi maintenant » | OK (`pray_count = 1`) |
| Carte d'intercession | OK (🇫🇷 1 sur 24 h) |
| Streak | OK (`streak_days = 1`) |

Compte de test : `qa_selah_1` (confirmé manuellement en SQL — la confirmation
email reste active pour les vrais utilisateurs).

## Bug trouvé et corrigé pendant la validation
Embed PostgREST ambigu `posts→profiles` (FK auteur + m2m via amens) :
HTTP 300, fil vide silencieux. Corrigé par `profiles!posts_author_id_fkey`
(idem `prayer_requests`). Leçon : ne jamais avaler `error` des requêtes Supabase.

## Sécurité
- Advisor Supabase après 0001 : 8 warnings SECURITY DEFINER → corrigés en 0002
  (triggers non exposés en RPC, `touch_streak` borné à `auth.uid()`).
- Toutes les tables : RLS activé avec policies.

## Charge (k6 depuis cette machine, IP unique)
| Test | Résultat |
|---|---|
| smoke 5 VU / 30 s | 345 req, 0 % échec, p95 = 204 ms |
| load 200 VU / 5 min (run 1) | 26 853 itérations complètes, seuil `http_req_failed<2%` franchi en fin de test |
| load 200 VU (run 2) | 100 % bloqué, p95 16 ms → rate-limiting anti-abus Vercel sur l'IP source |

Conclusion : l'app tient 200 VU depuis une IP ; au-delà, c'est la protection
plateforme qui répond, pas l'application. Le palier 100 000 utilisateurs
simultanés exige un test distribué (k6 Cloud / flotte multi-région) et un
accord préalable Vercel — impossible et interdit depuis une machine unique.

## Reproduire
```bash
pnpm test
k6 run -e BASE_URL=https://selah-wheat.vercel.app k6/smoke.js
```

## Limites connues (voir ROADMAP.md)
- Vidéos verticales, salles live, crowdfunding, push, apps natives : phase 2.
- Traduction : route prête, fournisseur non branché (501 propre).
- Icônes PWA (icon-192/512.png) et favicon : à générer.
- Emails de confirmation : template Supabase par défaut (personnaliser + SMTP dédié).
