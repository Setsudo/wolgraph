# wolgraph

Next.js 16 (App Router) + TypeScript strict + Tailwind 4 + Supabase (Postgres, Auth), deployed on Vercel. Node 22, npm.

## Commands
- Dev: `npm run dev`
- Lint / types: `npm run lint`, `npm run typecheck`
- Unit tests: `npm test` (Vitest; SQL tests run migrations in PGlite)
- E2E: `npm run e2e` (Playwright; needs `.env.local` Supabase credentials)
- Build: `npm run build`

## Conventions
- Geometry (`lib/wheel`, `lib/radar`) and aggregation (`lib/data/aggregates.ts`) are pure functions with unit tests; components only render and dispatch.
- All data access goes through `lib/data`; no direct Supabase calls in components.
- Schema changes are new files in `supabase/migrations/`; never edit an applied migration. Keep `lib/data/types.ts` in sync.
- Angles: degrees, clockwise from 12 o'clock.
- Hours are 0.25 h steps; 0 means delete the row. No hard deletes of categories: archive.
- Theme colors come from tokens in `app/globals.css`, never literal hex in components.
- Update `filemap.md` when adding or moving files.

## Docs
- `docs/SPEC.md`: what and why. `docs/PLAN.md`: tasks and status. `filemap.md`: where things live.
