# filemap

- `CLAUDE.md` — agent conventions and commands; keep under 60 lines
- `docs/SPEC.md` — MVP scope, data model, design decisions; change only with owner approval
- `docs/PLAN.md` — task list and status; tick tasks as they are accepted
- `filemap.md` — this index; update when adding or moving files
- `AGENTS.md` — Next.js-managed agent notes; rewritten by `next dev`, commit as is
- `package.json`, `package-lock.json` — npm scripts and dependencies
- `next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `.prettierrc.json`, `.prettierignore` — build, types, lint, format config
- `vitest.config.mts` — unit tests (`*.test.ts`, node) and component tests (`*.test.tsx`, jsdom)
- `playwright.config.ts`, `e2e/` — Playwright e2e specs; `PLAYWRIGHT_CHROMIUM_PATH` overrides the browser binary
- `.env.example` — required env vars (Supabase URL and anon key)
- `.github/workflows/ci.yml` — CI: install, lint, typecheck, unit tests
- `app/layout.tsx`, `app/globals.css` — root layout; theme tokens (`@theme`)
- `app/page.tsx` — redirects to `/day/<today>`
- `app/(auth)/login/page.tsx` — sign-in (placeholder)
- `app/(app)/layout.tsx` — signed-in shell with main nav
- `app/(app)/day/[date]/page.tsx`, `app/(app)/trends/page.tsx`, `app/(app)/categories/page.tsx` — app screens (placeholders)
- `lib/date.ts` — local-date helpers (`todayLocal`)
- `lib/wheel/geometry.ts` — pure two-ring wheel layout, SVG paths, hit testing, fill opacity
