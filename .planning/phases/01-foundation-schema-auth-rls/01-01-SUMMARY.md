---
phase: 01-foundation-schema-auth-rls
plan: 01
subsystem: infra
tags: [next.js, next-intl, supabase, tailwind, typescript, rtl, i18n]

# Dependency graph
requires: []
provides:
  - "Working Next.js 15.5.18 (App Router, TypeScript, Tailwind v4.3) shell that builds + serves locally"
  - "next-intl v4 locale routing — `/` redirects to `/he/`, Accept-Language en routes to `/en/`, `<html dir>` rendered server-side"
  - "Three @supabase/ssr client variants (server / browser / service) with correct cookie plumbing and `import 'server-only'` guard on the service-role client"
  - "Combined middleware: next-intl locale handling + Supabase cookie refresh using `getClaims()` (NOT `getSession()`)"
  - "Design tokens from UI-SPEC §Color wired as `--zc-*` CSS variables in `globals.css`"
  - "Tailwind v4.3 logical-property shorthand utilities (`bs-*`, `is-*`, `mi-*`, `pi-*`, `inset-i-*`, `min-bs-*`, `max-is-*`) added via `@utility` so the FND-03 lint has no escape hatch"
  - "Locale dictionaries (`messages/he.json`, `messages/en.json`) — skeleton; Plan 01-04 expands"
  - "Supabase project linked via CLI (`supabase/config.toml`); ready for migrations in Plan 01-02"
  - ".env.example committed, .env.local populated and gitignored"
affects:
  - "01-02 (schema + RLS): runs migrations against the linked Supabase project; consumes `supabase/config.toml`"
  - "01-03 (seed): same db link; consumes server client"
  - "01-04 (auth + UI shell): consumes server/browser Supabase clients, locale routing, design tokens, and the Tailwind logical-property utilities"
  - "01-05 (deploy + heartbeat): consumes service client, env vars, build output"
  - "All Phase 2/3 plans: every later screen is an `[locale]/...` route under the existing shell"

# Tech tracking
tech-stack:
  added:
    - "next@15.5.18"
    - "eslint-config-next@15.5.18"
    - "react@19.x (pinned via next 15.5)"
    - "next-intl@4.12.0"
    - "@supabase/supabase-js@^2.45 + @supabase/ssr@^0.5"
    - "tailwindcss@4.3.x + @tailwindcss/postcss + @tailwindcss/cli"
    - "zod@4.4.3"
    - "clsx + tailwind-merge@2.6.1"
    - "supabase@2.101.0 (CLI, devDep)"
    - "@eslint/eslintrc (FlatCompat shim for ESLint flat config)"
  patterns:
    - "Locale-prefixed routing — every page lives under `src/app/[locale]/...`; outer `app/layout.tsx` does NOT exist (canonical root is `[locale]/layout.tsx` per next-intl v4)"
    - "Server-rendered `<html dir>` driven by URL params (never `useEffect`), so no hydration mismatch"
    - "Three-client Supabase pattern: `createClient()` in `server.ts` (RSC + Server Actions, cookie-aware), `createClient()` in `client.ts` (browser), `createServiceClient()` in `service.ts` (server-only, service-role)"
    - "Combined middleware: `intlMiddleware(request)` first, then `refreshSupabaseSession(request, response)`; matcher excludes `/api`, `/_next`, `/_vercel`, `/admin`, and static files"
    - "Authority of CLAUDE.md: when the plan and project tech-stack ref disagreed (Next 16 vs 15.5), CLAUDE.md won — Next 16 was downgraded to 15.5.18"
    - "Tailwind v4.3 + custom `@utility` shorthands: native `pbs-/pbe-/mbs-/mbe-/ps-/pe-/ms-/me-/inset-bs-/inset-be-/inset-s-/inset-e-` plus shorthand aliases (`bs-/is-/mi-/pi-/inset-i-/min-bs-/max-is-`) emitting canonical CSS logical-property longhands"
    - "Service-role isolation: `service.ts` starts with `import 'server-only';` so build fails loudly if it ever ends up in a client bundle"

key-files:
  created:
    - "package.json — deps + scripts (db:types/db:reset/db:push/db:link/lint:rtl)"
    - "tsconfig.json — strict TS, App Router-aware, typedRoutes enabled"
    - "next.config.ts — wraps with `createNextIntlPlugin('./src/lib/i18n/request.ts')`"
    - "postcss.config.mjs — @tailwindcss/postcss"
    - "eslint.config.mjs — flat config via `@eslint/eslintrc` FlatCompat (next/core-web-vitals + next/typescript)"
    - ".gitignore — adds `.env*.local`, `.env`, `src/types/supabase.ts`, `.vercel/`, supabase temp/branches dirs"
    - ".env.example — all six required env vars documented, no values"
    - ".env.local — populated with provisioned Supabase values; gitignored"
    - ".vscode/settings.json — editor config"
    - "src/middleware.ts — combined next-intl + Supabase session refresh; matcher excludes /admin per D-05"
    - "src/app/globals.css — Tailwind v4 import, `@theme` font tokens, `--zc-*` color tokens, `@utility` extensions"
    - "src/app/[locale]/layout.tsx — canonical root layout; `<html lang dir>` server-rendered; Heebo+Inter via next/font/google; NextIntlClientProvider"
    - "src/app/[locale]/page.tsx — placeholder landing using `useTranslations('home')` (Plan 01-04 rewrites)"
    - "src/lib/i18n/routing.ts — `defineRouting({ locales: ['he','en'], defaultLocale: 'he', localePrefix: 'always' })`"
    - "src/lib/i18n/request.ts — `getRequestConfig` resolving messages by locale"
    - "src/lib/supabase/server.ts — `createServerClient` for RSC + Server Actions with explicit CookieOptions"
    - "src/lib/supabase/client.ts — `createBrowserClient` for client components"
    - "src/lib/supabase/service.ts — `import 'server-only'`; service-role client for heartbeat + (future) admin actions"
    - "src/lib/supabase/middleware.ts — `refreshSupabaseSession()` using `getClaims()` per T-01-02 mitigation"
    - "messages/he.json — Hebrew skeleton (`home.placeholder`, `common.loading`)"
    - "messages/en.json — English skeleton (`home.placeholder`, `common.loading`)"
    - "supabase/config.toml — project linked via `supabase init` + `supabase link --project-ref`"
    - "supabase/.gitignore — excludes `.branches/` and `.temp/`"
    - "public/*.svg — default next.js assets (kept for now)"
  modified: []

key-decisions:
  - "Pin Next 15.5.18 (NOT 16.x): create-next-app defaulted to Next 16.2.6; downgraded to satisfy CLAUDE.md (15.5 LTS through Oct 21 2026 avoids `middleware.ts` -> `proxy.ts` churn on a 3-week deadline) and to pick up the CVE-2025-66478 patch on the 15.5 line"
  - "src/middleware.ts (NOT project-root middleware.ts): Next 15 with --src-dir requires the middleware file inside src/"
  - "Deleted the pass-through outer src/app/layout.tsx: next-intl v4 + Next 15.5 requires `[locale]/layout.tsx` to be the canonical root; globals.css import moved into it"
  - "Tailwind v4.3 @utility shorthand layer (bs-*, is-*, mi-*, pi-*, inset-i-*, min-bs-*, max-is-*): v4.3 ships canonical pbs-/mbs-/ps-/etc. but NOT these shorthand aliases; plan + UI-SPEC assumed both forms exist, so defined the aliases as `@utility` blocks emitting the canonical longhand CSS so the FND-03 lint can't bypass logical properties"
  - "ESLint flat config via `@eslint/eslintrc` FlatCompat: plan's bare flat-config syntax failed under eslint-config-next@15.5; added `@eslint/eslintrc` devDep + wrapper"
  - "Explicit `CookieOptions` types in src/lib/supabase/{server,middleware}.ts: strict tsconfig flagged implicit-any on the cookies.setAll destructure"

patterns-established:
  - "Pattern 1: When the plan and CLAUDE.md disagree on tech versions, CLAUDE.md wins — it's the project-level source of truth, not the per-plan code block."
  - "Pattern 2: Use `[locale]/layout.tsx` as the canonical root layout. Do NOT create a pass-through `app/layout.tsx`."
  - "Pattern 3: Supabase auth checks use `getClaims()` (validates JWT against JWKS); never `getSession()` (trusts cookies blindly). Documented at `src/lib/supabase/middleware.ts`."
  - "Pattern 4: Service-role client files start with `import 'server-only';` so client-bundle leaks fail the build, not silently expose the secret."
  - "Pattern 5: Tailwind logical-property utilities are the only allowed form; if a shorthand is needed and v4.3 doesn't ship it, add an `@utility` alias in globals.css that emits the canonical CSS logical-property longhand."

requirements-completed:
  - FND-01
  - FND-02
  - FND-04
  - I18N-01
  - I18N-02
  - I18N-04

# Metrics
duration: 32min
completed: 2026-05-23
---

# Phase 01 Plan 01: Bootstrap Foundation Summary

**Next.js 15.5.18 App Router shell scaffolded with next-intl v4 he/en locale routing (Hebrew default, server-rendered `<html dir>`), three @supabase/ssr client variants with `getClaims()`-based session refresh in combined middleware, and Tailwind v4.3 with the UI-SPEC design tokens plus `@utility` logical-property shorthands.**

## Performance

- **Duration:** ~32 min
- **Started:** 2026-05-23T20:27:35Z
- **Completed:** 2026-05-23T20:59:23Z
- **Tasks:** 3 (1 human-action, 1 auto, 1 human-verify)
- **Files modified:** 29 (all new — greenfield bootstrap)

## Accomplishments

- Next.js 15.5.18 boots locally; `npm run build` exits 0
- `/` redirects 307 to `/he/` (Hebrew default); `Accept-Language: en-US` lands on `/en/`
- `<html lang="he" dir="rtl">` and `<html lang="en" dir="ltr">` rendered server-side (visually confirmed by the user, no hydration warnings, no FOUC)
- Three Supabase clients (server, browser, service) wired with proper cookie plumbing; service client guarded by `import 'server-only'`
- Combined middleware uses `getClaims()` per T-01-02 (NOT `getSession()`)
- UI-SPEC design tokens live as `--zc-*` CSS variables; Heebo (he) + Inter (en) loaded via `next/font/google`
- Tailwind v4.3 logical-property utilities verified in compiled CSS bundle (`block-size:`, `inline-size:`, `margin-inline:`, `padding-block-start/end:`, `margin-block-start:`, `inset-block-start:`, `inset-inline:`)
- Supabase project provisioned, linked via CLI, `supabase/config.toml` committed
- `.env.example` committed with all six required keys; `.env.local` populated and gitignored
- Visually approved on real browser at 375px width — no horizontal scroll, RTL/LTR both correct

## Task Commits

1. **Task 1: Provision Supabase project** — no commit (credentials only — `.env.local` is gitignored; `.env.example` committed as part of Task 2)
2. **Task 2: Scaffold Next.js 15.5 + i18n + Supabase clients** — `4dc3a18` (feat)
3. **Task 3: Browser RTL verification** — no commit (user-approved visual checkpoint)

**Plan metadata commit:** _to follow this summary_ (docs)

## Files Created/Modified

### Created (29 files via commit 4dc3a18)
- `package.json` — deps + scripts (db:types, db:reset, db:push, db:link, lint:rtl, dev, build, start, lint)
- `package-lock.json` — npm lockfile (7326 lines)
- `tsconfig.json` — strict TS for App Router, `typedRoutes` enabled
- `next.config.ts` — wraps next config with `createNextIntlPlugin('./src/lib/i18n/request.ts')`; `typedRoutes: true`
- `postcss.config.mjs` — `@tailwindcss/postcss` plugin
- `eslint.config.mjs` — flat config via `@eslint/eslintrc` FlatCompat shim (next/core-web-vitals + next/typescript)
- `.gitignore` — Next/Vercel/Supabase exclusions + `.env*.local` + `src/types/supabase.ts`
- `.env.example` — six keys with no values (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY, SUPABASE_ACCESS_TOKEN, SUPABASE_PROJECT_REF, INVITE_CODE, ADMIN_DISPLAY_NAME)
- `.vscode/settings.json` — editor config
- `src/middleware.ts` — combined next-intl + Supabase session refresh; matcher excludes /api, /_next, /_vercel, /admin, static files
- `src/app/globals.css` — Tailwind v4 import, `@theme` font tokens, `--zc-*` color tokens, `@utility` shorthand extensions
- `src/app/[locale]/layout.tsx` — canonical root layout with `<html lang dir>`, Heebo+Inter via `next/font/google`, NextIntlClientProvider, generateStaticParams + setRequestLocale
- `src/app/[locale]/page.tsx` — placeholder landing using `useTranslations('home')`
- `src/app/favicon.ico` — default next.js favicon (kept)
- `src/lib/i18n/routing.ts` — defineRouting with `defaultLocale: 'he'`, `localePrefix: 'always'`
- `src/lib/i18n/request.ts` — `getRequestConfig` resolving messages from `messages/${locale}.json`
- `src/lib/supabase/server.ts` — `createClient()` for RSC + Server Actions with explicit CookieOptions
- `src/lib/supabase/client.ts` — `createClient()` (createBrowserClient)
- `src/lib/supabase/service.ts` — `createServiceClient()` with `import 'server-only';`
- `src/lib/supabase/middleware.ts` — `refreshSupabaseSession()` using `getClaims()`
- `messages/he.json` — Hebrew skeleton (`home.placeholder`, `common.loading`)
- `messages/en.json` — English skeleton (`home.placeholder`, `common.loading`)
- `supabase/config.toml` — linked Supabase project config (~408 lines)
- `supabase/.gitignore` — excludes `.branches/` + `.temp/`
- `public/file.svg`, `public/globe.svg`, `public/next.svg`, `public/vercel.svg`, `public/window.svg` — default next.js assets (kept; will be replaced or removed in later plans)

### Modified
None — this is the greenfield bootstrap commit.

## Decisions Made

See `key-decisions` in frontmatter. The six recorded decisions all stem from collision between the plan's literal code blocks and the actual behavior of the toolchain (Next 16 default install, missing Tailwind shorthand utilities, ESLint flat-config syntax, strict tsconfig inference).

The core pattern that emerged: **CLAUDE.md is the project-level source of truth on tech versions; per-plan code blocks may lag.** Future plans should consult CLAUDE.md when versions disagree.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Pinned `next@15.5.18` and `eslint-config-next@15.5.18`**
- **Found during:** Task 2 (step 1 — bootstrap)
- **Issue:** `create-next-app@latest` installed Next 16.2.6 by default. Plan and CLAUDE.md both require 15.5 LTS — Next 16 introduces `middleware.ts` -> `proxy.ts` churn that is out-of-scope on a 3-week deadline. Pinning 15.5.18 also picks up the CVE-2025-66478 patch.
- **Fix:** After bootstrap, ran `npm install next@15.5.18 eslint-config-next@15.5.18 --save-exact` and re-ran `npm install` to align the lockfile.
- **Files modified:** `package.json`, `package-lock.json`
- **Verification:** `npm run build` succeeds; no `proxy.ts` migration warnings.
- **Committed in:** `4dc3a18` (part of Task 2)

**2. [Rule 3 - Blocking] Moved `middleware.ts` to `src/middleware.ts`**
- **Found during:** Task 2 (step 15)
- **Issue:** Plan places middleware at project root. Next 15 with the `--src-dir` flag requires middleware to live inside `src/` — the build does not pick up a root-level `middleware.ts` when `src/` is the source root.
- **Fix:** Wrote the file at `src/middleware.ts` instead of `./middleware.ts`.
- **Files modified:** `src/middleware.ts` (created at the corrected path; no root-level file ever existed)
- **Verification:** `npm run dev` logs show the middleware running on `/` and redirecting to `/he`.
- **Committed in:** `4dc3a18` (part of Task 2)

**3. [Rule 3 - Blocking] Deleted pass-through `src/app/layout.tsx`**
- **Found during:** Task 2 (step 16-17)
- **Issue:** Plan step 16 instructs writing a pass-through outer `app/layout.tsx`. In Next 15.5 + next-intl v4, the canonical pattern is to make `[locale]/layout.tsx` the ROOT layout (it owns the `<html>` tag). A second layout above it causes "you have two `<html>`s" build errors.
- **Fix:** Did not create `src/app/layout.tsx`. Moved the `import './globals.css';` line into `src/app/[locale]/layout.tsx` instead, so the CSS still loads on every page.
- **Files modified:** `src/app/[locale]/layout.tsx`
- **Verification:** Build succeeds, page renders, CSS variables resolve in the browser.
- **Committed in:** `4dc3a18` (part of Task 2)

**4. [Rule 3 - Blocking] Added Tailwind v4.3 `@utility` extensions in `globals.css`**
- **Found during:** Task 2 (step 21 + B6 build-snapshot verify)
- **Issue:** Tailwind v4.3 ships `pbs-*`, `pbe-*`, `mbs-*`, `mbe-*`, `ps-*`, `pe-*`, `ms-*`, `me-*`, `inset-s-*`, `inset-e-*`, `inset-bs-*`, `inset-be-*` natively. Plan + UI-SPEC also reference `bs-*` (block-size), `is-*` (inline-size), `mi-*` (margin-inline), `pi-*` (padding-inline), `inset-i-*` (inset-inline), `min-bs-*` (min-block-size), `max-is-*` (max-inline-size) shorthand forms which v4.3 does NOT ship.
- **Fix:** Added `@utility` blocks in `src/app/globals.css` that emit the canonical CSS logical-property longhands. Example: `@utility bs-dvh { block-size: 100dvh; }`, `@utility min-bs-screen { min-block-size: 100vh; }`. This keeps the FND-03 lint air-tight (no physical-direction escape hatch).
- **Files modified:** `src/app/globals.css`
- **Verification:** B6 build-snapshot grep checks pass — compiled CSS bundle contains `block-size:`, `inline-size:`, `margin-inline:`, `padding-block-start:`, `padding-block-end:`, `margin-block-start:`, `inset-block-start:`, `inset-inline:`.
- **Committed in:** `4dc3a18` (part of Task 2)

**5. [Rule 3 - Blocking] Rewrote `eslint.config.mjs` with `@eslint/eslintrc` FlatCompat**
- **Found during:** Task 2 (step 1 — bootstrap probe)
- **Issue:** Plan's bare flat-config syntax failed under `eslint-config-next@15.5` — `eslint-config-next` ships as a legacy `.eslintrc` extends-style config and needs the `@eslint/eslintrc` FlatCompat shim to load inside a flat `eslint.config.mjs`.
- **Fix:** Added `@eslint/eslintrc` as a devDep; wrote `eslint.config.mjs` using `FlatCompat({ baseDirectory: __dirname }).extends('next/core-web-vitals', 'next/typescript')`.
- **Files modified:** `eslint.config.mjs`, `package.json`
- **Verification:** `npx eslint src/ messages/` runs cleanly (no config errors).
- **Committed in:** `4dc3a18` (part of Task 2)

**6. [Rule 1 - Bug] Added explicit `CookieOptions` types**
- **Found during:** Task 2 (steps 11 + 14 — typecheck)
- **Issue:** Strict tsconfig flagged implicit-any on the `cookies.setAll(cookiesToSet)` destructure in `src/lib/supabase/server.ts` and `src/lib/supabase/middleware.ts`.
- **Fix:** Imported `CookieOptions` from `@supabase/ssr` and explicitly typed the destructure: `cookiesToSet.forEach(({ name, value, options }: { name: string; value: string; options: CookieOptions }) => ...)`.
- **Files modified:** `src/lib/supabase/server.ts`, `src/lib/supabase/middleware.ts`
- **Verification:** `npm run build` passes with no TS errors.
- **Committed in:** `4dc3a18` (part of Task 2)

### Notes (not deviations)

**7. Dep version resolution during install probe:** `tailwind-merge@2.6.1`, `next-intl@4.12.0`, `zod@4.4.3`, Supabase CLI `2.101.0`, `@tailwindcss/cli` were resolved by npm and retained. None drift outside the plan's `^x` ranges.

**8. 2 moderate npm audit findings:** Transitive `postcss <8.5.10` inside `next`. Only fix is a breaking change to next@9. Accepted — risk is local-dev only (PostCSS parses our own CSS), and waiting for the next Next patch is the right move.

---

**Total deviations:** 6 auto-fixed (5 blocking, 1 bug) + 2 informational notes
**Impact on plan:** All six fixes are corrections to the plan, not regressions. The biggest cross-plan implication is the Tailwind utility surface — see "Next Plan Readiness" below.

## Issues Encountered

None beyond the deviations above. Task 3's browser checkpoint passed visually on first attempt (no hydration warnings, no horizontal scroll at 375px, both locales correct).

## User Setup Required

**Yes — Supabase project provisioning was required.** See [01-USER-SETUP.md](./01-USER-SETUP.md) for:
- Five environment variables that must live in `.env.local` (already done for this run)
- Supabase Dashboard steps to recreate the project if the values are ever lost
- Verification commands

## Next Plan Readiness

**Ready for Plan 01-02 (Schema + RLS):**
- Supabase CLI is installed and the project is linked (`supabase/config.toml` present)
- `npm run db:push` / `db:reset` / `db:types` scripts exist and pick up `SUPABASE_ACCESS_TOKEN` + `SUPABASE_PROJECT_REF` from `.env.local`
- `src/lib/supabase/server.ts` is ready to consume the schema once migrations land

**Surfacing to downstream plans:**
- **Plan 01-04 (auth + UI shell):** MUST use Tailwind v4.3 canonical logical-property utilities (`pbs-*`, `pbe-*`, `mbs-*`, `mbe-*`, `ps-*`, `pe-*`, `ms-*`, `me-*`, `inset-bs-*`, `inset-be-*`, `inset-s-*`, `inset-e-*`) OR the `@utility` shorthand aliases defined in `src/app/globals.css` (`bs-*`, `is-*`, `mi-*`, `pi-*`, `inset-i-*`, `min-bs-*`, `max-is-*`). Do NOT introduce physical-direction utilities (FND-03 lint will reject).
- **All later plans:** Next.js is pinned at `15.5.18`; middleware lives at `src/middleware.ts` (NOT root). Do not upgrade to 16.x without re-evaluating the `proxy.ts` migration.
- **Plan 01-05 (deploy + heartbeat):** Service-role client at `src/lib/supabase/service.ts` is already `import 'server-only'`; safe to import from `/api/heartbeat/route.ts`.

**Concerns:** None blocking. The 2 moderate npm-audit findings are accepted (transitive postcss in next, no breaking-change fix available).

## Self-Check: PASSED

- All 29 files from `4dc3a18` exist on disk (verified via `ls -la src/ src/lib/ src/lib/supabase/ src/lib/i18n/ src/app/ src/app/[locale]/ messages/ supabase/ public/`)
- Commit `4dc3a18` present in `git log --oneline -10`
- Requirements FND-01, FND-02, FND-04, I18N-01, I18N-02, I18N-04 all map to deliverables shipped in this plan
- No stub patterns found in the placeholder home page (the `home.placeholder` string is intentional and documented as Plan 01-04 expansion territory)
- No threat-model surface introduced beyond what the plan's `<threat_model>` already accounts for

---
*Phase: 01-foundation-schema-auth-rls*
*Completed: 2026-05-23*
