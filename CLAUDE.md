<!-- GSD:project-start source:PROJECT.md -->
## Project

**Zarur-Cup / משחקי זערור**

A bilingual (Hebrew/English) web platform where the Zarur family runs friendly, no-money World Cup prediction pools. Family members log in with a shared invite code, pick scores for every match, fill out the knockout bracket, and answer tournament-level prop bets — points roll up to one unified leaderboard so we can argue about it at dinner.

Built for **FIFA World Cup 2026**, kickoff **June 11, 2026**.

**Core Value:** **Predictions submitted before kickoff get scored automatically against a unified leaderboard that the whole family can see.** If the leaderboard is broken or wrong, nothing else matters.

### Constraints

- **Timeline**: Must be live and usable by **June 11, 2026** (WC opening match) — non-negotiable. About 3 weeks from project start.
- **Tech stack (recommended)**: Next.js (App Router), Tailwind CSS with RTL support, Supabase (Postgres + Auth), deploy on Vercel. Driven by: family-scale traffic, free tier headroom, fast iteration, RTL-friendly tooling.
- **Bilingual**: Hebrew RTL + English LTR must both render correctly; no second-class language. Locale dictionary architecture must be in place from phase 1.
- **Budget**: Hobby-tier — free hosting (Vercel free, Supabase free) must cover ~15 active users + read-heavy traffic during matches.
- **Identity**: Invite-code based; no per-user email collected by default; family trust covers anti-cheat. Identity must persist across sessions on the same device.
- **Locking**: Match predictions lock at fixture kickoff time (UTC-aware, since family spans timezones); after lock, predictions become visible to all users.
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->
## Technology Stack

## Executive Summary
## Recommended Stack
### Core Technologies
| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **Next.js** | `15.5.x` (latest 15.x LTS line) | React meta-framework, App Router, RSC, server actions, edge-aware routing | LTS until Oct 21, 2026 — perfectly covers WC 2026 timeline. Next.js 16 exists but introduces churn (e.g. `middleware.ts` → `proxy.ts`) that you don't want on a 3-week deadline. App Router has been stable since 13.4 and is the only thing the docs recommend for new projects. `getClaims()` for auth checks + server actions for mutations is the canonical 2026 pattern. **HIGH confidence** (verified against nextjs.org/blog/next-15-5). |
| **React** | `19.x` | UI library — server components, `useActionState`, `<form action>` integration | Ships with Next 15.5; required for the cleanest server-action ergonomics. Don't pin React separately — let Next dictate. **HIGH confidence**. |
| **TypeScript** | `5.5+` (whatever `create-next-app` ships) | Type safety, route typing | Next 15.5 ships stable typed routes (`typedRoutes: true`) and globally-available `PageProps`/`LayoutProps` types — turn both on. Zero cost, huge payoff on a small codebase. **HIGH confidence**. |
| **Tailwind CSS** | `4.3.x` (stable as of May 2026) | Utility-first styling, RTL via logical properties | v4 is the 2026 standard; v4.2 shipped complete logical-property utilities (`pbs-*`, `mbs-*`, `inline-*`, `block-*`, `inset-s-*`, `inset-e-*`) which **eliminate the need for a separate RTL plugin**. Just author with logical properties and flip `<html dir>` per locale. Note: `start-*`/`end-*` are deprecated in v4.2+ — use `inset-s-*`/`inset-e-*`. **HIGH confidence**. |
| **Supabase** | `@supabase/supabase-js` `^2.x` (latest) + `@supabase/ssr` `^0.5+` | Postgres database, Auth, Realtime, Storage | Free-tier headroom dwarfs your needs (500MB DB, 50K MAU, 200 concurrent realtime, 2M realtime msgs/mo — you'll use maybe 5MB and 15 concurrent at peak). `@supabase/ssr` is the **only** correct package for Next App Router — `@supabase/auth-helpers-nextjs` is deprecated. Switch to new `sb_publishable_*`/`sb_secret_*` keys now — legacy keys work through end of 2026 but better to start clean. **HIGH confidence**. |
| **next-intl** | `^4.x` | i18n: locale routing, server-component translations, plural rules, ICU messages | 2026 default for App Router. ~2KB runtime, native RSC support, `getTranslations()` on the server, `useTranslations()` on the client, built-in middleware for locale routing and detection. Full RTL support — you set `dir` on `<html>` based on locale, library handles message formatting. **HIGH confidence**. |
| **Vercel** | Hobby (free) plan | Deployment, edge functions, image optimization, cron | Native Next.js integration, free TLS, free preview deploys per PR, free Cron Jobs (use these to ping Supabase). 10-second function timeout is the only watch-out — irrelevant for this app's CRUD shape. **HIGH confidence**. |
### Supporting Libraries
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **Zod** | `^4.x` | Schema validation — share between client form + server action + DB insert | v4 stable, ~57% smaller bundle and 10x faster type-check than v3. Use for: invite-code form, pick-submission form, admin result-entry form. One schema, validated both sides. **HIGH confidence**. |
| **React Hook Form** | `^7.x` | Client-side form state, validation feedback, dirty/touched tracking | Pair with Zod via `@hookform/resolvers/zod`. Use **only on the bracket and per-match prediction forms** where local validation UX matters (showing real-time error states). For simple single-field forms (invite code, display name), prefer plain `<form action={serverAction}>` + `useActionState` — less code. **MEDIUM confidence** — could be skipped entirely if you keep forms simple. |
| **`@hookform/resolvers`** | `^3.x` | Bridge Zod 4 ↔ React Hook Form | Standard pairing. **HIGH confidence**. |
| **`@supabase/ssr`** | `^0.5+` | Cookie-based session storage for Next App Router (server components, route handlers, middleware) | Required for server-side auth in App Router. Creates separate "browser client" and "server client" instances with proper cookie plumbing. **HIGH confidence**. |
| **`rtl-detect`** *(optional)* | `^1.x` | Map locale code → `"rtl"` / `"ltr"` | One-line helper. Or inline a 4-line map `{he: 'rtl', en: 'ltr'}` and skip the dep. Prefer inline for a 2-locale app. **MEDIUM confidence** — likely don't need. |
| **`clsx`** + **`tailwind-merge`** *(optional)* | latest | Conditional class composition | Standard Tailwind hygiene. Tiny. Optional but most projects pull it in. |
### Development Tools
| Tool | Purpose | Notes |
|------|---------|-------|
| **`create-next-app@latest`** | Bootstrap project | Use it. Pick App Router, TypeScript, Tailwind, ESLint. |
| **Playwright** `^1.50+` | E2E testing — auth flow, prediction-submission lock, leaderboard math | The **only** test framework you need on a 3-week timeline. One smoke test for invite-code login, one for "submit pick before kickoff, verify locked after, verify score after admin enters result." That's it. **HIGH confidence**. |
| **Vitest** | Unit testing (skip on this timeline) | Would be the right choice if you had unit logic to test (scoring math, locale formatting). On 3 weeks, defer — put scoring logic in pure functions and write 3 Playwright assertions instead. **MEDIUM confidence** that you can skip it. |
| **ESLint (flat config)** | Linting | `create-next-app` generates a flat `eslint.config.mjs` in 15.5+. Use as-is. Don't customize. |
| **Prettier** | Formatting | Optional. Pleasant on a team; you're solo. Add if you want, otherwise skip. |
| **Supabase CLI** | Local DB, migrations, type-gen | `npx supabase gen types typescript --linked > types/supabase.ts` after every schema change. This is the one piece of tooling discipline that pays off massively. **HIGH confidence**. |
| **Vercel Cron** | Anti-pause heartbeat for Supabase | Schedule a `/api/heartbeat` route to ping Supabase every 3 days. See "Free-tier gotchas" below. |
## Installation
# Bootstrap
# Core
# Forms (only if you decide to use RHF for bracket/pick forms)
# Optional ergonomics
# Dev
# Supabase CLI (one-time)
## Auth: The Invite-Code-Without-Email Question — Recommended Approach
### Why this approach over the alternatives
| Approach | Verdict | Reasoning |
|---|---|---|
| **A. `signInAnonymously()` + invite-code gate** *(recommended)* | YES | Native Supabase. You get a real `auth.users` row with a UUID, a JWT, and RLS works out of the box. Anonymous users are flagged via `is_anonymous` JWT claim — easy to write policies against. You implement: (1) form takes invite code + display name, (2) server action verifies code against `invite_codes` table, (3) calls `supabase.auth.signInAnonymously()`, (4) inserts `profiles` row keyed to the new `auth.uid()` with the display name. Session is cookie-based, persists via `@supabase/ssr`. |
| **B. Roll your own session on Supabase Postgres** (no Supabase Auth) | NO | You lose RLS-via-JWT and have to plumb session cookies, CSRF, expiry yourself. Probably a week of work. Not worth it for a 3-week project. |
| **C. Supabase magic-link email auth + invite code as gate** | NO | Adds email collection — explicitly out of scope per PROJECT.md ("no per-user email collected by default"). Adds friction at signup. |
| **D. Use a third-party auth (Clerk, Auth.js) just for invite codes** | NO | Extra service, extra free-tier ceiling to worry about, no benefit over (A). |
### The known limitation (call this out to user explicitly)
### Other gotchas
- Add **CAPTCHA / Turnstile** to the invite-code form to prevent endpoint abuse (Supabase rate-limits anon sign-ins to 30/hr/IP, but be defensive). Cloudflare Turnstile is free.
- **Always use `getClaims()` on the server**, never `getSession()`. `getClaims()` validates the JWT signature; `getSession()` trusts cookies. This is Supabase 2026 best practice and the difference is real — `getSession()` on a server can give you a stale session that survived a sign-out elsewhere.
- RLS policies should reference `auth.uid()` for ownership *and* `(auth.jwt() ->> 'is_anonymous')::boolean` if you ever want to gate certain actions to "permanent" users — you won't here, but it's there.
## Data Fetching Strategy
### Rationale
| Surface | Pattern | Why |
|---------|---------|-----|
| Fixture list, leaderboard initial load, user's own picks page | RSC + direct `await supabase...` | Zero client JS, fastest first paint, type-safe, free caching from Next |
| Live leaderboard updates during a match | Client component + `supabase.channel().on('postgres_changes', ...)` | This is the one place realtime earns its complexity. Subscribe to `predictions` or `match_results` table changes, optimistically merge into local state. |
| Submitting a pick, updating display name, admin entering result | Server Action + `revalidatePath('/leaderboard')` | Cleanest mutation flow in 2026. No client fetcher needed. |
## Date/Time Strategy
### Why no library
- You have **one** date operation: "format a UTC timestamp into the user's locale (he-IL or en-US) with their timezone." `Intl.DateTimeFormat` does this natively, zero bytes shipped.
- Hebrew month names, AM/PM, weekday names all work out of the box: `new Intl.DateTimeFormat('he-IL', { dateStyle: 'full', timeStyle: 'short', timeZone: 'Asia/Jerusalem' }).format(new Date(kickoffISO))`.
- Comparisons ("is now past kickoff?") are `Date.now() >= new Date(kickoffISO).getTime()` — no library needed.
- next-intl actually wraps `Intl.DateTimeFormat` for you with locale-aware helpers (`format.dateTime(date, 'short')`) — use those.
### When to reach for a library
## Forms Strategy
### Decision tree
| Form | Pattern | Why |
|------|---------|-----|
| Invite-code login (1 field) | `<form action={serverAction}>` + `useActionState` + Zod schema | Simplest. No client state. Errors come back via action state. |
| Display-name change (1 field) | Same as above | Same. |
| Per-match score predictions (group stage list — many rows on one screen) | RHF + Zod resolver + server action | You want local optimistic UX, dirty-state tracking, "save all" semantics. Worth the dep. |
| Bracket predictions (interactive tree) | RHF + Zod resolver + server action | UI state is non-trivial; RHF keeps it manageable. |
| Admin result entry (one match at a time) | `<form action>` + `useActionState` | One row, one submit. No RHF. |
## i18n Strategy
### Structure
## Alternatives Considered
| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Next.js 15.5 (App Router) | Next.js 16 | After the tournament. 15.5 is LTS through Oct 2026, no upgrade pressure during the project window. |
| Next.js 15.5 (App Router) | Remix / TanStack Start / SvelteKit | You'd lose Vercel native integration and `@supabase/ssr` first-class support. Stick with Next. |
| Tailwind v4 + logical properties | `tailwindcss-rtl` plugin | Plugin still exists but is **legacy** as of v4 — v4's native logical-property utilities replace it. Use plugin only if you're stuck on Tailwind v3. |
| Tailwind v4 + logical properties | `tailwindcss-vanilla-rtl` | Same — only if you have constraints that prevent v4. |
| `next-intl` v4 | Hand-rolled JSON dictionary | Acceptable for *true* MVP if you have only ~30 strings and no plural rules. Once you have plurals ("3 משחקים נשארו"), date formatting, or locale-routed URLs, you'll regret it. Don't roll your own. |
| Native `Intl.DateTimeFormat` | `date-fns@^4` + `date-fns-tz` | If you need date arithmetic (add/subtract days, compute durations). Skip both `Day.js` (legacy plugin model) and the Temporal API proposal (still stage-3 in some envs, not worth the polyfill on this timeline). |
| Server Actions | tRPC / REST API routes | tRPC is overkill for a 3-week project with one frontend. Server Actions = same DX, zero schema duplication. |
| Server Components + Realtime channel | TanStack Query v5 + `useQuery` | If you discover the leaderboard needs complex client-side merging across multiple data sources. You won't here. |
| `signInAnonymously()` | Clerk / Auth.js | If the family ever wants cross-device login. You can migrate later by linking an email to the anonymous user (`updateUser({ email })`) — that's a designed migration path. |
| Playwright | Vitest + Testing Library | If the project grows past v1 and you build complex client-side scoring logic. For v1, Playwright covers the only paths that matter. |
## What NOT to Use
| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `@supabase/auth-helpers-nextjs` | **Deprecated.** Officially superseded by `@supabase/ssr`. Old tutorials still show it. | `@supabase/ssr` |
| Supabase legacy `anon` / `service_role` keys (only) | Work through end of 2026 but rotating to `sb_publishable_*` / `sb_secret_*` now avoids a forced migration later. | New publishable + secret keys |
| Pages Router | Maintenance mode; new APIs (server actions, `useActionState`) land in App Router first. | App Router with `src/app/[locale]/...` |
| `next-i18next` | App Router support is bolted on; ecosystem momentum has moved to next-intl. | `next-intl@^4` |
| `tailwindcss-rtl` plugin (with Tailwind v4) | Redundant — v4 ships native logical-property utilities. | `pbs-*`, `mbs-*`, `inline-*`, `inset-s-*`, etc. |
| `getSession()` in server code | Doesn't revalidate JWT — can return stale auth that survived a sign-out elsewhere. Documented Supabase footgun. | `getClaims()` for auth checks; `getUser()` if you need the user record |
| Moment.js | Deprecated, no tree-shaking, huge bundle. | `Intl.DateTimeFormat` (first) or `date-fns@^4` (if you need arithmetic) |
| TanStack Query for v1 | Adds weight and a parallel data-fetching mental model alongside RSC. | RSC + Server Actions + targeted Realtime subscription |
| `next lint` command | Deprecated in 15.5, removed in 16. | Direct `eslint` invocation (`create-next-app` generates this for you now) |
| `legacyBehavior` on `<Link>` | Removed in Next 16. | Modern `<Link href="...">children</Link>` |
| External sports-data API | Out of scope per PROJECT.md, adds rate-limit failure surface. | Manual admin result entry (already decided) |
| Real-money / payments libraries | Out of scope per PROJECT.md (no gambling). | N/A |
## Free-Tier Gotchas (Vercel + Supabase)
| Limit | Free-Tier Cap | Your Expected Load | Risk |
|-------|---------------|--------------------|------|
| Supabase DB storage | 500 MB | < 5 MB (64 matches × 15 users × picks + bracket + props rows ≈ ~2K rows total) | None |
| Supabase egress | 5 GB/mo | < 100 MB | None |
| Supabase MAU | 50,000 | 15 | None |
| Supabase Realtime concurrent | 200 | ≤ 15 (only during live match watch parties) | None |
| Supabase Realtime msgs/mo | 2,000,000 | < 10K (write to match_results 64×) | None |
| **Supabase auto-pause** | **Project pauses after 7 days no API requests** | **Tournament gap nights could trigger** | **REAL — mitigate** |
| Vercel bandwidth | 100 GB/mo (Hobby) | < 1 GB | None |
| Vercel function exec timeout | 10s | < 100ms (CRUD) | None |
| Vercel cron jobs | Free on Hobby | Use for heartbeat | — |
### Mitigation for auto-pause
### Env-var hygiene
| Variable | Scope | Source |
|----------|-------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | Client + server | Supabase dashboard |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Client + server | Supabase dashboard (new key format) |
| `SUPABASE_SECRET_KEY` | Server ONLY (no `NEXT_PUBLIC_` prefix) | Supabase dashboard. Used in route handlers / server actions that need bypass-RLS (admin result entry). |
| `INVITE_CODE` | Server ONLY | Set on Vercel. Server action checks input against this. Rotate per-tournament. |
## Stack Patterns by Variant
- Pull scoring into a pure module (`src/lib/scoring.ts`) with inputs `(prediction, actual) → points`.
- Add Vitest *just* for that file. ~30 min setup, infinite payoff when you doubt a leaderboard number.
- After tournament v1: implement "claim your account" — user enters email, server calls `supabase.auth.updateUser({ email })` on the anonymous user → magic-link confirmation → account now permanent and cross-device.
- Don't build this for v1.
- Skip realtime entirely. Use `revalidatePath('/leaderboard')` from the admin's "save result" server action, and a `setInterval` poll-every-15s on the client-side leaderboard. Family is 15 people, this is cheaper and more debuggable than realtime.
## Version Compatibility
| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `next@15.5` | `react@19`, `react-dom@19` | Required pairing. `create-next-app` handles it. |
| `next@15.5` | `tailwindcss@4` | Use `@tailwindcss/postcss` plugin (default in `create-next-app`) or `@tailwindcss/webpack` for faster builds on Turbopack. |
| `@supabase/ssr@0.5+` | `@supabase/supabase-js@2.45+` | Peer dep. Install both. |
| `next-intl@4` | `next@15.5` | Works. For Next 16 the middleware file becomes `proxy.ts` — you won't hit this on 15.5. |
| `zod@4` | `@hookform/resolvers@3.10+` | Resolver added Zod 4 support; older versions of `@hookform/resolvers` only support Zod 3. |
| `playwright@1.50+` | `next@15.5` dev server | Use Playwright's `webServer` config to auto-launch `next dev` for tests. |
## Confidence Assessment
| Recommendation | Confidence | Basis |
|----------------|-----------|-------|
| Next.js 15.5 App Router | HIGH | Verified against nextjs.org official blog post |
| Tailwind v4 + logical properties (no RTL plugin) | HIGH | Verified against tailwindcss.com v4.3 blog post; v4.2 added complete logical-property suite |
| `@supabase/ssr` + `signInAnonymously()` for invite-code auth | HIGH | Verified against supabase.com docs (auth-anonymous, server-side/nextjs). Device-locked limitation explicit in docs. |
| `next-intl` v4 for App Router i18n | HIGH | Verified against next-intl.dev; widely-adopted 2026 default |
| Server Components + Server Actions over TanStack Query | HIGH | TanStack's own docs recommend this for new RSC apps |
| Native `Intl.DateTimeFormat` over date library | HIGH | Standard 2026 advice; library only needed for arithmetic |
| Zod 4 + React Hook Form (selective) + Server Actions | HIGH | Verified against zod.dev v4 release notes; standard Next 15 pattern |
| Playwright only, skip Vitest | MEDIUM | Opinionated on 3-week constraint; Vitest would be added back if scoring complexity grows |
| Vercel + Supabase free-tier headroom | HIGH | Verified against pricing pages; load estimates conservative |
| Auto-pause mitigation via Vercel Cron | HIGH | Vercel Cron is free on Hobby; verified pattern |
| New Supabase API keys (`sb_publishable_*` / `sb_secret_*`) | HIGH | Verified against supabase.com docs |
## Sources
- [Next.js 15.5 release blog](https://nextjs.org/blog/next-15-5) — version, LTS window, App Router status, typed routes, deprecations
- [Next.js Server-Side Auth guide (Supabase)](https://supabase.com/docs/guides/auth/server-side/nextjs) — `@supabase/ssr` package, `getClaims()` vs `getSession()`
- [Supabase Anonymous Sign-Ins](https://supabase.com/docs/guides/auth/auth-anonymous) — device-locked sessions, RLS via `is_anonymous` claim, rate limits
- [Tailwind CSS v4.3 release](https://tailwindcss.com/blog/tailwindcss-v4-3) — logical properties, `inset-s-*` / `inset-e-*`, Next.js install
- [Tailwind CSS v4.2 InfoQ writeup](https://www.infoq.com/news/2026/04/tailwind-css-4-2-webpack/) — webpack plugin, logical-property completion
- [next-intl App Router docs](https://next-intl.dev/docs/getting-started/app-router) — v4 setup
- [Supabase Realtime + Next.js](https://supabase.com/docs/guides/realtime/realtime-with-nextjs) — postgres_changes subscription patterns
- [Supabase Pricing](https://supabase.com/pricing) — free-tier limits
- [Vercel Pricing](https://vercel.com/pricing) — Hobby plan limits, function timeout
- [Zod v4 release notes](https://zod.dev/v4) — stability, bundle size, performance
- [TanStack Query Advanced SSR guide](https://tanstack.com/query/v5/docs/react/guides/advanced-ssr) — explicit "skip until you need it" guidance for RSC apps
- [next-intl Tutorial 2026 (intlpull)](https://intlpull.com/blog/next-intl-complete-guide-2026) — RTL + Hebrew specifics
- [Locize: next-intl vs next-i18next](https://www.locize.com/blog/next-intl-vs-next-i18next/) — ecosystem comparison
- [Supabase Pricing real-cost analysis (UI Bakery)](https://uibakery.io/blog/supabase-pricing) — auto-pause behavior on free tier
- [Vercel + Supabase 2026 integration writeup (Kuberns)](https://kuberns.com/blogs/vercel-supabase/) — deployment patterns
- [PkgPulse date library comparison 2026](https://www.pkgpulse.com/guides/date-fns-v4-vs-temporal-api-vs-dayjs-2026) — confirms native `Intl` is sufficient for format-only use cases
- [DEV: Anonymous auth with Supabase + Next.js](https://dev.to/thatanjan/how-to-add-anonymous-authentication-to-your-nextjs-app-using-supabase-1aai) — implementation reference
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
