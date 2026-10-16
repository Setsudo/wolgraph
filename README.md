# wolgraph

Wheel of Life: log hours per life area each day on a two-ring wheel, and see weekly and monthly balance on a radar. Next.js 16 + Supabase, hosted on Vercel. Scope: `docs/SPEC.md`.

## Set up your own copy

### 1. Supabase (database and sign-in)

1. Create a free project at [supabase.com](https://supabase.com/dashboard).
2. **SQL Editor → New query**: paste all of `supabase/migrations/0001_init.sql` and run it. This creates the tables, row-level security and the trigger that seeds the eight default categories on first sign-in.
   Then, in a new query, paste and run `supabase/migrations/0002_ratings.sql` (the 0-10 life ratings behind the home screen). Until it runs, the home screen works but shows that scores aren't saved.
3. **Authentication → URL Configuration**:
   - Site URL: your Vercel production URL (or `http://localhost:3000` until you have one).
   - Redirect URLs: add `http://localhost:3000/**` and `https://*-<your-vercel-team-slug>.vercel.app/**` (covers preview deployments), plus your production URL followed by `/**`.
4. **Project Settings → API**: copy the Project URL and the `anon` public key. Never put the `service_role` key in this app.

### 2. Vercel (hosting)

1. [Import](https://vercel.com/new) the GitHub repo. Framework preset: Next.js (detected).
2. Before deploying, add two environment variables for Production and Preview:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

   They are inlined at build time, so redeploy after changing them.
3. Each pull request gets a preview deployment; `master` deploys to production.

### 3. Local development

```bash
cp .env.example .env.local   # fill in the two values
npm install
npm run dev                  # http://localhost:3000
```

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run lint`, `npm run typecheck` | ESLint, `tsc --noEmit` |
| `npm test` | Vitest: geometry, aggregation, components, and SQL/RLS tests in PGlite (no Supabase needed) |
| `npm run e2e` | Playwright smoke tests |
| `npm run build` | Production build |

Dev-only previews with fixture data (no sign-in, 404 in production): `/dev/rate-preview`, `/dev/day-preview`, `/dev/trends-preview`, `/dev/categories-preview`.
