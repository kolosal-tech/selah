# Repository Guidelines

## Project Structure & Module Organization

- `src/app/` contains App Router pages, layouts, API routes, and feed components.
- `src/lib/` holds domain/Supabase helpers; `src/i18n/` holds locales and messages.
- `tests/` contains Vitest tests (`*.test.ts`), with focused `profile/` and `videos/` suites.
- `supabase/migrations/` stores ordered database/RLS changes. Dubbing tools are in `scripts/doublage/`; assets in `public/`; runbooks in `docs/`.

## Build, Test, and Development Commands

Run from the repository root (`selah/`):

```bash
pnpm install --frozen-lockfile # install the locked dependency set
pnpm dev                       # start Next.js locally on port 3000
pnpm lint                      # run ESLint
pnpm test                      # run the Vitest suite once
pnpm test:e2e                  # run Playwright on desktop and Pixel 7
pnpm test:rls                  # validate the RLS baseline SQL
pnpm test:schema               # validate schema reconstruction SQL
pnpm build                     # create the production build
```

## Coding Style & Naming Conventions

Use strict TypeScript, two-space indentation, double quotes, and semicolons; follow ESLint. Use `PascalCase` for components/types, `camelCase` for functions/variables, and lowercase kebab-case for route directories. Prefer `@/*`; keep pages server-rendered unless browser interaction requires `"use client"`.

## Testing Guidelines

Use Vitest with feature-named `describe` blocks and behavior-focused `it` cases. Add regression coverage for fixes, keep tests deterministic, run focused tests during development, then `pnpm test`. No coverage threshold is configured; review changed paths explicitly.

## Commit & Pull Request Guidelines

Use Conventional Commits with an optional lowercase scope (for example, `feat(i18n): ...`, `fix(rtl): ...`, or `docs: ...`). PRs should explain the change, list validation and migration/config impacts, link an issue, and include UI screenshots. Keep unrelated refactors out.

## Security & Configuration Tips

Start from `.env.example`; keep `.env.local` and production credentials untracked and out of logs. Add database changes as new ordered migrations and run RLS/security tests when changing Supabase policies.

## Next.js Framework Instruction

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
