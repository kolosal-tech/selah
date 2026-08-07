# Déploiement — Selah

## 1. Backend Supabase (une fois le coût confirmé : 10 $/mois)
1. Créer le projet (région conseillée `eu-west-3` Paris ou `eu-central-1`).
2. Appliquer la migration : contenu de `supabase/migrations/0001_selah_core.sql`
   (via MCP `apply_migration` ou dashboard SQL editor).
3. Auth → désactiver « Confirm email » pour l'onboarding immédiat (ou configurer SMTP).
4. Récupérer URL + clé publishable.

## 2. Variables d'environnement
```
NEXT_PUBLIC_SUPABASE_URL=…
NEXT_PUBLIC_SUPABASE_ANON_KEY=…
```

## 3. Vercel
```bash
# depuis selah/ — le build se fait dans le cloud Vercel
vercel deploy --prod
```
(ou MCP Vercel `deploy_to_vercel`)

## 4. Validation post-déploiement
```bash
pnpm test                                   # 14 tests unitaires
k6 run -e BASE_URL=https://<prod> k6/smoke.js
k6 run -e BASE_URL=https://<prod> k6/load.js
```
Parcours manuel : signup (charte) → post → amen → prière → « Je prie » → carte → sabbat.

## Sécurité post-provisionnement
- Lancer l'advisor Supabase (`get_advisors` security) après migration — zéro table sans RLS attendu.
