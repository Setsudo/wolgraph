# Wheel of Life: MVP plan

Each task names its tier, dependencies and verification. Spec: `docs/SPEC.md`. Status markers: `[ ]` open, `[x]` accepted.

## 1. [x] Scaffold (Medium; first, nothing parallel)
Next.js 16 App Router + TypeScript strict + Tailwind 4 at the repo root, npm. Add Vitest (jsdom for components), Playwright, ESLint (next config), Prettier, `@supabase/supabase-js`, `@supabase/ssr`. Theme tokens from SPEC §7 in `app/globals.css`. Route skeletons from SPEC §4 rendering placeholders. `.env.example` with `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`. GitHub Actions workflow: install, lint, typecheck, unit tests. Update `filemap.md`.
Verify: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` all pass; dev server renders each route.

## 2. [x] Database schema, RLS, seed (Careful; after 1)
`supabase/migrations/0001_init.sql` implementing SPEC §5 exactly: tables, checks, parent-is-main and one-level constraint (trigger), partial unique index, RLS policies, `seed_default_categories()` called by a trigger on `auth.users` insert. Generate `lib/data/types.ts` by hand to match.
Verify: Vitest suite runs the migration in PGlite with a stub `auth` schema (`auth.users`, `auth.uid()` reading a session setting) and asserts: seed creates 8 mains; hours check rejects 0.1 and 25; sub-of-sub rejected; RLS isolates two users for all four operations.

## 3. [x] Wheel geometry (Careful; after 1, parallel with 2)
`lib/wheel/geometry.ts`: given main categories with subcategory counts, return segments `{categoryId, ring, startAngle, endAngle, innerR, outerR, path, labelPoint, labelAngle}` per SPEC §7; `hitTest(x, y)`; opacity from hours. No React.
Verify: unit tests for 1, 3, 8 and 12 mains; mains with 0 and 5 subs; angles sum to 360; hit tests at sector centres and boundaries; label angles keep text upright.

## 4. [ ] Radar geometry and aggregation (Medium; after 2)
`lib/radar/geometry.ts` (axis angles, polygon points, ring paths) and `lib/data/aggregates.ts`: totals and per-day averages per active main category for a week (Mon–Sun) or calendar month, rolling subcategory hours into their main, excluding days with no entries from the divisor.
Verify: fixture-based unit tests including archived categories, empty period, a main with only sub entries, month length 28/31.

## 5. [ ] Auth (Medium; after 2)
Supabase server/browser clients in `lib/supabase`, middleware session refresh, `(auth)/login` magic-link form with sent/error states, sign-out, `(app)` routes redirect to login without a session, `/` redirects to `/day/<today>`.
Verify: unit test for redirect logic; e2e against the dev Supabase project once credentials exist (SPEC §8), otherwise reported as blocked on credentials.

## 6. [ ] Daily entry screen (Careful; after 3, 5)
`components/Wheel.tsx` + `HourSheet.tsx` + `(app)/day/[date]` per SPEC §6.2 and §7: render from geometry, tap and keyboard selection, sheet stepper and chips, optimistic debounced upsert/delete via Server Action, rollback and toast on error, day navigation, future days read-only, center total with >24 warning.
Verify: component tests for stepper math and keyboard navigation; Playwright screenshots at 390 and 1440 px; e2e log-reload-persist once credentials exist.

## 7. [ ] Categories screen (Medium; after 5)
`(app)/categories` per SPEC §6.4: add main (palette picker), add sub, inline rename with validation (1–40 chars, unique among active siblings), archive, Archived section with restore.
Verify: component tests for validation; e2e rename-and-history check once credentials exist; screenshots at 390 and 1440 px.

## 8. [ ] Trends screen (Medium; after 4, 5)
`components/Radar.tsx` + `(app)/trends` per SPEC §6.3: Week/Month toggle, period arrows, radar, totals table, empty state.
Verify: component test with fixture data; screenshots at 390 and 1440 px.

## 9. [ ] Deploy and e2e smoke (Light; after 6, 7, 8 and owner's SPEC §8 setup)
Link Vercel project, set env vars, apply migration to the Supabase project, Playwright smoke in CI against Preview: sign-in via Supabase admin-generated link, log hours, see them on trends. README with setup steps.
Verify: CI green on the PR; Production URL loads and signs in.
