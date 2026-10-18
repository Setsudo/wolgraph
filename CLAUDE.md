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

## Data integrity
The app stores two things per user per day: a 0-10 rating per main category (`ratings`, Rate screen, `saveRating`) and hours per category or subcategory (`entries`, Log screen, `saveEntry`). Both are upserts keyed on user, category and day, written only from server actions.
- Every day starts empty. Rate sliders show the day's saved score or 0 (`displayedScore`); Log shows only that day's entries (the previous day is read only to size the copy button). Never read an earlier day to pre-fill or carry over a value.
- A rating is written only when the user moves that slider. A category with no row for the day is "not rated" (null on Trends), never 0 or any other value. Gap: once saved, a rating cannot be cleared back to "not rated", and an untouched slider looks the same as a saved 0.
- Hours are written only on explicit input (stepper, chip, Clear); 0 deletes the row. "Copy yesterday's hours" (`copyPreviousDay`) writes only on its tap, shows only on an empty editable day, and inserts with conflicts ignored so it never overwrites; its Undo clears only untouched copied rows.
- Display aids never write: the dashed outline of the last rated day (`ghost` from `getRatings`), and any future ghost or preview, are render-only.
- No code path may insert ratings or entries the user did not enter, including on load, unmount or navigation (flushing a pending user edit is fine).
- Schema changes, data migrations and back-fills need the owner's OK before they are written. This is process only; nothing in code enforces it.

## Docs
- `docs/SPEC.md`: what and why. `docs/PLAN.md`: tasks and status. `filemap.md`: where things live.
