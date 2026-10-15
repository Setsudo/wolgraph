# Backlog

Ranked by the owner. The loop takes the top open item, builds it with tests, verifies (lint, types, unit, screenshots at 390 and 1440 px), pushes to the open PR, and reports with the preview link. Schema changes wait for owner approval. Status: `[ ]` open, `[~]` in progress, `[x]` shipped to preview.

## Polish (round 1)
1. [x] Wheel: a main category with no subcategories is one segment spanning both rings; the outer ring appears only under mains that have subcategories.
2. [x] Wheel: category names follow the arc and shrink to fit instead of truncating.
3. [x] Day screen desktop layout: larger wheel, centered, hours panel anchored beside it with an empty-state hint.
4. [x] Wheel: any logged time shows a clearly visible fill (minimum opacity 0.4).
5. [x] Trends: larger radar with less empty space; scale labels no longer collide with category labels.

## Reference look (owner request 2026-10-15; reference: docs/design/reference-wheel.png)
6. [x] Shared "life wheel" chart in the reference style (sector wedges, concentric circles, values at sector centres, curved uppercase serif labels outside, teal fill); Trends radar switches to it.
7. [x] "Rate your life" (approved 2026-10-15 13:24 UTC, saves scores; home page) screen: eight 0-10 sliders around the wheel (left: 5,6,7,0; right: 4,3,2,1 by category order), saved per day. Schema: `supabase/migrations/0002_ratings.sql`, run by the owner in Supabase.

## Connect Wheel and Day (owner-approved 2026-10-15)
Wheel = how each area feels (0-10 score), Day = where the time went (hours). Same categories, angles and dates; these items make the two read as one system.
8. [x] Wheel matches Day: category colors on the Wheel's value dots and sliders (labels stay navy for contrast), and the same previous/next day arrows (rate any past day, future days locked). UI only.
9. [ ] Trends shows ratings beside hours: average score per category for the period next to average hours, on the same wheel layout and in the totals table. Reads existing tables, no schema change.
10. [ ] Rename nav items: "Wheel" becomes "Rate", "Day" becomes "Log" (routes unchanged).

## Features (proposed order, awaiting owner confirmation)
11. [ ] Subcategories on the wheel: end-to-end check and fixes (add subs, log against them, trends roll-up).
12. [ ] Copy yesterday's hours onto today in one tap.
13. [ ] Weekly target per category, shown on the radar and totals. Schema change: needs approval.
14. [ ] Year view on Trends.

## Infrastructure
- [ ] Automated sign-in e2e in CI against the Vercel preview (needs `SUPABASE_SERVICE_ROLE_KEY` as a GitHub Actions secret, added by the owner).
