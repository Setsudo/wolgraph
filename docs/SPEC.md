# Wheel of Life: MVP spec

Status: draft for approval, 2026-10-15. Source of intent: `WoL/docs/system/system_charter.md` (v0.1.1). This spec cuts the charter down to an MVP.

## 1. Goals

A personal web app for logging how many hours went into each area of life each day, and seeing the balance over a week or month.

1. Log a day in under 2 minutes by tapping a two-ring wheel (main categories inside, subcategories outside).
2. See weekly and monthly balance as a radar chart of average hours per day per main category.
3. Shape your own categories: add, rename, archive and restore, with no history lost.
4. Sign in from any device and see the same data.

## 2. Non-goals (MVP)

Yearly view, reordering categories, moving a subcategory to another main category, dark mode, export, Google/Apple sign-in, goals or targets, reminders, sharing, native apps, calendar import, AI insights. The schema must not block any of these later.

## 3. Stack

| Layer | Choice |
|---|---|
| App | Next.js 16 (App Router), React 19, TypeScript (strict) |
| Styling | Tailwind CSS 4, theme tokens in `app/globals.css` |
| Data and auth | Supabase: Postgres + Auth (email magic link), `@supabase/supabase-js` 2.x, `@supabase/ssr` 0.12.x |
| Charts | Hand-written SVG from pure geometry functions (wheel and radar). No chart library. |
| Tests | Vitest 5 (unit, geometry, aggregation, SQL via PGlite), Playwright 1.64 (e2e smoke) |
| Hosting | Vercel (Production from `master`, Preview per PR) |
| Node | 22 LTS |

## 4. Architecture

```
app/
  (auth)/login           magic-link sign-in
  (app)/day/[date]       daily entry wheel (default route redirects to today)
  (app)/trends           weekly / monthly radar
  (app)/categories       manage categories
lib/
  supabase/              server + browser clients, middleware session refresh
  wheel/geometry.ts      pure: sector angles, arc paths, hit testing (no React)
  radar/geometry.ts      pure: axis angles, polygon points, ring paths
  data/                  typed queries: categories, entries, aggregates
components/
  Wheel.tsx              renders geometry, handles taps, keyboard accessible
  HourSheet.tsx          bottom sheet stepper for one category on one day
  Radar.tsx
supabase/migrations/     SQL schema, RLS, seed function
```

Rules: geometry and aggregation are pure and unit tested; components only render and dispatch. All data access goes through `lib/data`, never raw Supabase calls in components. Server Components read, Server Actions write.

## 5. Data model

```sql
categories (
  id          uuid pk default gen_random_uuid(),
  user_id     uuid not null references auth.users on delete cascade,
  parent_id   uuid null references categories(id),   -- null = main category
  name        text not null check (length(trim(name)) between 1 and 40),
  color       text not null,                          -- hex, main categories only; subs inherit
  sort_order  int  not null,
  archived_at timestamptz null,
  created_at  timestamptz not null default now()
)
-- a subcategory's parent must be a main category of the same user (one level only)
-- unique (user_id, parent_id, lower(name)) where archived_at is null

entries (
  user_id     uuid not null references auth.users on delete cascade,
  category_id uuid not null references categories(id),
  day         date not null,
  hours       numeric(4,2) not null check (hours >= 0 and hours <= 24 and hours * 4 = floor(hours * 4)),
  updated_at  timestamptz not null default now(),
  primary key (user_id, category_id, day)
)
```

- Hours go in 0.25 h steps. Setting a value to 0 deletes the row.
- Hours can be logged on a main category directly and on its subcategories. A main category's total for a day = its own entry + its subcategories' entries.
- A day's total may differ from 24 (charter assumption). Totals over 24 show a warning, not an error.
- Rename keeps the id, so history follows. Archive sets `archived_at`; archived categories disappear from the entry wheel and category pickers but their hours stay in the database and in trend aggregates for the periods they were logged. Restore clears `archived_at`. No hard deletes in the MVP.
- RLS on both tables: `user_id = auth.uid()` for select, insert, update, delete.
- On first sign-in a SQL function seeds eight main categories, no subcategories: Health, Personal Growth, Finance, Family, Career, Relaxation, Relationships, Spirituality (the user's established set), each with a palette color.

## 6. Key flows

1. **Sign in.** Email field, "Send link". Link signs in and lands on today's wheel. Session refresh in middleware; every `(app)` route requires a session.
2. **Log a day.** Wheel shows today. Tap a sector: a bottom sheet opens with the category name, the current hours, − / + buttons (0.25 h), quick chips (0.5, 1, 2, 4, 8) that add to the value, and "Clear". Changes save automatically (optimistic, debounced 400 ms, error toast and rollback on failure). Header arrows and a date picker move between days; future days are not editable.
3. **Trends.** Toggle Week / Month; arrows move by one period. Radar axes are active main categories in sort order; value = total hours in period ÷ days in period that have any entry. Below the chart, a table lists each category's total and average. Empty periods show an empty state, not a zero polygon.
4. **Categories.** List of main categories with their subcategories. Add main (name, color from palette), add sub (name), rename inline, archive, and a collapsed "Archived" section with Restore.

## 7. Design decisions

Palette carried from the slider prototype: cream `#F8F1E4` background, navy `#1F2A44` text, teal `#2F8C8C` accent; seeded category colors: Health #2F8C8C, Personal Growth #5B6CC0, Finance #3E8E4F, Family #C9831F, Career #C8553D, Relaxation #7A5BA8, Relationships #C2557F, Spirituality #4F7C9E. New categories pick from the same eight. Serif display (Georgia) for headings, system sans for UI text.

**Entry wheel** (see mockup in the project thread):
- Two concentric rings, 12 o'clock start, clockwise, equal-angle sectors for active main categories in `sort_order`. Equal angles, not hour-proportional, so tap targets never shrink.
- Inner ring: main categories. Outer ring: each main's subcategories split its angle equally. A main with no subs is one segment spanning both rings (owner-approved 2026-10-15; previously a duplicate outer segment).
- The outer ring is display only (owner-approved 2026-10-16): sub segments are not tap or keyboard targets and are hidden from screen readers; tapping anywhere on a main's inner or outer segments selects that main, and the selected main's inner and outer segments all show the selection outline. Main sector angles stay equal (they match the Rate and Trends wheels).
- Each segment's fill opacity scales with that day's hours (0 h = outline only, any logged time at least 40%, 8 h+ = full color); hours shown as text in segments with any time, category names follow the arc and shrink to fit. In the outer ring a sub's name and its hours are each drawn only when they fit in its arc, never overlapping.
- "Today" is the user's local date, determined in the browser (server time on Vercel is UTC).
- Center: day total "6.5 h of 24", turns amber over 24.
- Minimum tap target 44 px; the wheel is keyboard operable (arrow keys move between mains, Enter opens the sheet) and every main has an aria-label "Health, 9.5 hours, 3 subcategories": its total (own + all its subs, archived included, as the fill shows), plus the number of active subs when it has any.
- Hours sheet (owner-approved 2026-10-16): subcategories are edited here, not on the wheel. A main without subs keeps the single stepper. A main with subs shows its name, a muted "Total {h} h" line (the same total as its aria-label), then one row per category: "General" (the main's own hours) first, then each active sub in sort order, each with a compact − / + stepper (44 px buttons) and its own save status. One row is active (General when the sheet opens); tapping a row makes it active, and the quick-add chips ("Quick add to {row}") and Clear act on it. On phones the sheet is capped at 75% of the viewport height and the list scrolls.
- Mobile first: the wheel is full width up to 520 px; on desktop it sits left with the sheet as a side panel instead of a bottom sheet.

## 8. External dependencies needing the owner

1. A Supabase project (free tier) and its URL + anon key, added to Vercel env vars and `.env.local`. Without it the app runs only in unit tests.
2. Supabase Auth: site URL and redirect URLs set to the Vercel domain and `http://localhost:3000`.
3. Vercel project linked to `Setsudo/wolgraph`.

## 9. MVP definition of done

- [ ] A new user signs in by magic link and sees the eight seeded categories on today's wheel.
- [ ] Logging, changing and clearing hours persists across reload and across devices.
- [ ] Add, rename, archive and restore categories and subcategories; renamed and archived categories keep their history.
- [ ] Week and month radar show correct averages (unit tested against fixtures).
- [ ] RLS: one user cannot read or write another user's rows (SQL test).
- [ ] Daily entry for 8 categories takes under 2 minutes on a phone; pages render data in under 2 s on Vercel.
- [ ] Lint, typecheck, unit tests and e2e smoke pass in GitHub Actions; deployed on Vercel.
- [ ] Screenshots of all four screens at 390 px and 1440 px reviewed.

## 10. Rate your life

Owner-approved 2026-10-15. The home page (`/`, nav "Wheel") is a "Wheel of Life" self-rating screen modelled on `docs/design/reference-wheel.png`: each active main category gets a 0-10 slider, and the wheel in the middle plots the current values (one sector per main, rings 1-10).

- Ratings are for today only (the browser-local date, passed as `/rate?day=`); no day navigation yet. A slider shows the day's saved score, else 0: earlier scores are never carried over, so an untouched slider never records a false trend.
- The latest earlier day with any ratings shows as a faint dashed outline behind the day's shape (no dots, not animated), captioned "Dashed outline: {day}" under the day arrows. Display only (owner request 2026-10-18): it never sets a slider and is never saved.
- Only a slider the user moves is saved: optimistic, debounced 400 ms per category, rollback and error toast on failure, a small "Saved" status.
- From 768px: sliders in two side columns beside their sectors (right: indices k..1, left: k+1..n-1 then 0, k = floor(n/2)). Phones: wheel, then all sliders in category order.
- If the `ratings` table is missing, sliders still move the wheel, nothing is saved, and an amber notice says so.

```sql
ratings (
  user_id     uuid not null references auth.users on delete cascade,
  category_id uuid not null,
  day         date not null,
  score       smallint not null check (score between 0 and 10),
  updated_at  timestamptz not null default now(),
  primary key (user_id, category_id, day),
  foreign key (category_id, user_id) references categories (id, user_id)
)
-- trigger: category must be a main category (parent_id is null)
-- RLS: user_id = auth.uid() for select, insert, update, delete; anon has no access
```
