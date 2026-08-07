# Roadmap — Selah

## Livré (v0.1 — cette itération)
- Auth email/mot de passe + charte spirituelle signée à l'inscription
- Profils (pays, langue, rôle, église, streak)
- Fil : posts typés (témoignage, exhortation, prière, enseignement, louange),
  verset superposé, Amen, commentaires
- Mur de prière : requêtes (publiques/anonymes), « Je prie pour toi maintenant »,
  compteur d'intercesseurs
- Carte d'intercession mondiale (agrégat pays / 24 h)
- Mode Sabbat (24 h de blocage volontaire)
- Streaks spirituels (SQL + miroir testé)
- Paul & Timothée : offres de mentorat + demandes 1-to-1
- Annuaire des églises (ajout + badge vérifié)
- Modération : signalements + rôles
- API traduction branchable
- PWA (manifest, installable)

## Phase 2 (non livré — assumé)
- **Mini-vidéos verticales** (le « TikTok de l'Évangile ») : Supabase Storage +
  transcodage (Mux ou Cloudflare Stream), éditeur avec versets superposés
- **Salles de prière live « Upper Room »** : LiveKit ou Supabase Realtime broadcast audio
- **Semailles (crowdfunding)** : Stripe Connect — exige entité légale + conformité
- **Traduction instantanée réelle** : brancher un fournisseur (DeepL/Claude) sur /api/translate
- **Notifications push** (Web Push + FCM)
- **Apps natives** Expo (iOS/Android)
- **Dashboard pasteur**, défis communautaires (21 jours…), mode hors-ligne extrême
- **Modération IA** entraînée sur valeurs bibliques (file de revue humaine déjà en place)

## Stress-test
- Scripts k6 prêts : `k6/smoke.js`, `k6/load.js` (200 VU), `k6/stress.js` (1000 VU).
- 100 000 utilisateurs simultanés : hors de portée d'une seule machine ; nécessite
  k6 Cloud ou une flotte distribuée + montée de gamme Supabase/Vercel. Palier honnête
  actuel : validation jusqu'à 1000 VU depuis cette machine, extrapolation documentée.
