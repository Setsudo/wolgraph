# Backlog

Ranked by the owner. The loop takes the top open item, builds it with tests, verifies (lint, types, unit, screenshots at 390 and 1440 px), pushes to the open PR, and reports with the preview link. Schema changes wait for owner approval. Status: `[ ]` open, `[~]` in progress, `[x]` shipped to preview.

## Polish (round 1)
1. [~] Wheel: a main category with no subcategories is one segment spanning both rings; the outer ring appears only under mains that have subcategories.
2. [~] Wheel: category names follow the arc and shrink to fit instead of truncating.
3. [~] Day screen desktop layout: larger wheel, centered, hours panel anchored beside it with an empty-state hint.
4. [~] Wheel: any logged time shows a clearly visible fill (minimum opacity 0.4).
5. [~] Trends: larger radar with less empty space; scale labels no longer collide with category labels.

## Features (proposed order, awaiting owner confirmation)
6. [ ] Subcategories on the wheel: end-to-end check and fixes (add subs, log against them, trends roll-up).
7. [ ] Copy yesterday's hours onto today in one tap.
8. [ ] Weekly target per category, shown on the radar and totals. Schema change: needs approval.
9. [ ] Year view on Trends.

## Infrastructure
- [ ] Automated sign-in e2e in CI against the Vercel preview (needs `SUPABASE_SERVICE_ROLE_KEY` as a GitHub Actions secret, added by the owner).
