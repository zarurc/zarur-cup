# Phase 1: Foundation, Schema, Auth & RLS - Research

**Researched:** 2026-05-23
**Domain:** Bilingual (Hebrew RTL + English LTR) Next.js 15.5 App Router shell + Supabase Postgres schema + RLS + invite-code-only anonymous auth + WC 2026 data seed + Vercel Cron heartbeat
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Invite-Code Auth (AUTH-01, AUTH-02, AUTH-07)**
- **D-01:** Single static invite code stored in `INVITE_CODE` env var on Vercel (server-only, no `NEXT_PUBLIC_` prefix). Server Action on `/[locale]/join` compares the submitted value against `process.env.INVITE_CODE` exactly, then calls `supabase.auth.signInAnonymously()` and inserts a `profiles` row tied to `auth.uid()`. Rotation = change the env var on Vercel (instant). One shared code matches PROJECT.md's "shared family invite code."
- **D-02:** AUTH-07 (rate-limiting) is satisfied by **Supabase's built-in 30-anon-signins/hr/IP rate limit only**. No Cloudflare Turnstile, no per-IP attempt table in v1. **This is a deliberate re-interpretation of AUTH-07's wording** — capture it in the requirement's note column so it doesn't get flagged in audit.
- **D-03:** Wrong-code UX: inline error via `useActionState`; generic message (don't confirm whether the code format is even close — minor defense against guessing). Trim the submitted code; case-sensitive match.

**Admin Bootstrap (AUTH-06)**
- **D-04:** Admin identity is established via env-var display-name match. `ADMIN_DISPLAY_NAME` is a server-only env var on Vercel. The join Server Action sets `is_admin = true` when the chosen display name **exactly equals** `process.env.ADMIN_DISPLAY_NAME` (after the same normalization as the uniqueness check — see D-08). All other joiners get `is_admin = false`. Mitigation against name-squat: user (zekez) joins first.
- **D-05:** Admin routes live at unlocalized **`/admin/...`** (no `[locale]` segment). **This is a deliberate deviation from AUTH-06's literal "`/[locale]/admin/...`" wording.** The spirit of AUTH-06 (server-side gating, admin-only) is preserved. English-only admin pages avoid translation work for screens only one person sees.
- **D-06:** Admin gate enforced server-side at the layout level for `/admin/*` — Next middleware redirect + a server-side `getClaims()` + `profiles.is_admin` check in `app/admin/layout.tsx`. UI hiding is not the gate; server-side check is.

**Display-Name Policy (AUTH-03)**
- **D-07:** Length 2–24 characters. Allowed: Hebrew letters, Latin letters, digits, ASCII space (between non-space chars only — no leading/trailing whitespace after trim). Disallowed for v1: `< > / \ & ' " ; \``, control chars, emoji. Server-side rejection on the join Server Action via a shared Zod schema.
- **D-08:** Uniqueness is **case-insensitive + whitespace-trimmed + Unicode NFC-normalized**. Implemented as either a generated column on `profiles.display_name_normalized = lower(trim(normalize(display_name, NFC)))` with a unique index, or a unique functional index on `lower(trim(normalize(display_name, NFC)))`. The form display value preserves the original casing/composition.
- **D-09:** On conflict, return an inline error via `useActionState`: localized "This name is already taken — try another." No auto-suggestions, no auto-discriminator. User picks again.
- **D-10:** XSS defense in depth: validation layer rejects the dangerous characters; render layer relies on React's default JSX escaping (never `dangerouslySetInnerHTML` for display names).

**Late-Entrant Policy**
- **D-11:** **Open join, zero past points.** Family can join any time during the tournament. `profiles.joined_at timestamptz default now()`. Already-locked matches yield zero points because RLS rejects writes to `predictions` for fixtures past kickoff (same lock everyone hits). Props become read-only at first kickoff for everyone. Bracket picks become read-only at the bracket reveal moment in Phase 3.
- **D-12:** No "cutoff" kill-switch in the join Server Action. No admin approval flow.

**Bilingual Shell (FND-02, I18N-01..07, FND-06)**
- **D-13:** Visual personality: **Modern sports clean**. High-contrast minimal — single dark primary (dark green or navy, planner to pick exact hex), white/cream surface, single accent (yellow or red, planner to pick), generous whitespace, geometric sans typography.
- **D-14:** Logo / wordmark: **text-only wordmark**. Hebrew wordmark "משחקי זערור" primary on `/he/`; Latin wordmark "Zarur Cup" primary on `/en/`. The other locale's wordmark shown smaller below or omitted. No icon, no illustration.
- **D-15:** Typography: **Heebo (Hebrew) + Inter (Latin)**, both Google Fonts, self-hosted via `next/font/google`. Two weights each (400/500 + 700). Tailwind `font-sans` token switches by locale via `lang`-aware utility or a `dir`-aware CSS variable. Total font payload ≤ ~80KB.
- **D-16:** Mobile navigation: **bottom tab bar**, 3–4 tabs sized for thumb reach. Phase 1 tabs: `Matches` · `Bracket` (placeholder until Phase 3) · `Leaderboard` (placeholder until Phase 2) · `Me`. The bar uses flex-row + the `<html dir>` value, so tab order flips automatically in Hebrew.
- **D-17:** Locale toggle: **header pill** on the inline-end side of a sticky top header (HE/EN or a globe icon). On click, swaps locale on the current URL (`/he/foo` ↔ `/en/foo`) and persists to a cookie (and `profiles.locale` if signed in). Page stays on the same content in the new language. Always visible.

**Cron Heartbeat (FND-05)**
- **D-18:** `/api/heartbeat` is a public Next route handler scheduled by Vercel Cron every 3 days. Returns `{ ok: true, pinged_at: <ISO> }` after executing `SELECT id FROM fixtures LIMIT 1` against Supabase using the **service-role / secret key** (this must be a real DB query, not just a `select 1` against `auth`). Heartbeat is unauthenticated. Verify pings hit the DB via Supabase project logs, not just Vercel function logs.

**Schema & RLS (FND-04, DATA-*, VIS-06)**
- **D-19:** Tables to create in Phase 1: `tournament`, `profiles` (with `joined_at`, `locale`, `is_admin`, `display_name`, `display_name_normalized`), `teams`, `fixtures` (with `home_placeholder`, `away_placeholder` symbolic text refs), `bracket_slots`, `bracket_picks`, `predictions`, `prop_questions`, `prop_answers`. All timestamps `timestamptz`, never `timestamp`.
- **D-20:** RLS enabled at table creation. Lock-and-reveal policies reference `fixtures.kickoff_at <= now()` in both `USING` (reads) and `WITH CHECK` (writes). Use `(select auth.uid())` pattern (never bare `auth.uid()`) for performance per CVE-2025-48757 guidance. Even though `predictions` will have zero rows in Phase 1, the policy must be live so a curl from a logged-out terminal returns zero rows from the moment the schema is deployed.
- **D-21:** All migrations live in `supabase/migrations/` with sequential names. `npm run db:types` runs `npx supabase gen types typescript --linked > types/supabase.ts` after every schema change.
- **D-22:** WC 2026 seed: 48 teams with `name_en`, `name_he`, ISO country code, group letter. 104 fixtures with UTC kickoff times, stage labels, group codes, and symbolic placeholders for knockouts (`WINNER_GROUP_A`, `R32_M1_W`, etc.). Bracket slot graph (R32 → R16 → QF → SF → F + Champion) fully populated. DATA-04 Hebrew team-name native-speaker review happens **inside Phase 1**, not Phase 2 — it gates the schema/seed sign-off.

### Claude's Discretion

- Exact hex values for primary + accent in "Modern sports clean" palette — planner / UI-phase agent picks. Suggested starting points: primary `#0f3d2e` (dark forest) or `#0a2540` (deep navy); accent `#f59e0b` (warm yellow) or `#dc2626` (red).
- Tab labels' exact localized strings — UI-phase agent picks the Hebrew/English wording from `messages/{en,he}.json`.
- Whether `/api/heartbeat` returns a small JSON body or `204 No Content`.
- Whether the bracket slot graph is one denormalized table or two (slots + adjacency edges) — schema planner's call as long as the slot identity survives placeholder resolution.
- Exact migration file naming convention within `supabase/migrations/`.
- Whether `profiles.display_name_normalized` is a generated column or a functional unique index — both meet D-08; planner picks based on Postgres ergonomics. **This research recommends GENERATED COLUMN — see schema section §3.**

### Deferred Ideas (OUT OF SCOPE)

- **Cloudflare Turnstile on join form** — explicitly skipped for v1 (D-02). If abuse becomes a problem post-launch, add Turnstile + reinstate AUTH-07's literal wording.
- **Multi-language admin pages** — `/admin/...` is English-only for v1 (D-05). v2 concern.
- **Logo/iconography upgrade** — Phase 1 ships text wordmark only (D-14). A small mark can land in Phase 6 polish if time permits.
- **Admin "merge users" tool** for reconciling duplicate device-locked sessions (ADM-05) — Phase 2 admin dashboard scope. Schema-side, the `profiles` table already supports this in Phase 1, but no UI/Server Action in Phase 1.
- **Profile-level locale settings page UI** — the `profiles.locale` column exists in Phase 1's schema so D-17's header pill can update it, but no dedicated settings page in Phase 1.
- **Realtime leaderboard subscription, prediction history view, head-to-head, dark mode, badges** — all v2; not in scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| **FND-01** | Next.js 15 App Router project deployable on Vercel from `main` | §2 Standard Stack (Next 15.5 LTS); §10 Code Examples (`create-next-app` invocation) |
| **FND-02** | Tailwind v4 + `<html dir>` set server-side per locale (no FOUC) | §6 next-intl + Tailwind v4 RTL; §10 Code Examples (`app/[locale]/layout.tsx`) |
| **FND-03** | CI lint rule rejects physical-direction Tailwind utilities | §6 Logical Properties; §10 Code Examples (ESLint regex / grep pre-commit) |
| **FND-04** | Supabase project + `@supabase/ssr` + generated TS types | §2 Standard Stack; §10 Code Examples (`createServerClient`, `db:types` script) |
| **FND-05** | Vercel Cron `/api/heartbeat` every 3 days, real DB query | §7 Vercel Cron Heartbeat; §10 Code Examples (`vercel.json`, route handler) |
| **FND-06** | Mobile-responsive shell verified on real phone in HE+EN | §5 Bilingual Shell (bottom tab bar, header pill, font payload); §8 Common Pitfalls (RTL physical utilities) |
| **I18N-01** | `/he/...` (RTL) and `/en/...` (LTR) routing | §6 next-intl middleware setup; §10 Code Examples |
| **I18N-02** | First visit Accept-Language detection; Hebrew fallback | §6 `localeDetection: true` + `defaultLocale: 'he'`; §10 Code Examples |
| **I18N-03** | Toggle between HE/EN persists across sessions (cookie + `profiles.locale`) | §6 Cookie name (`NEXT_LOCALE`); §10 Code Examples (locale toggle Server Action) |
| **I18N-04** | All UI strings in `messages/{en,he}.json` via next-intl v4 | §6 Structure; §10 Code Examples |
| **I18N-05** | Team names, prop questions render in active locale (`_en`/`_he` columns) | §3 Schema (`teams.name_en` / `teams.name_he`); §4 Bilingual content split pattern |
| **I18N-06** | Mixed-direction strings (scores "2 - 1") render correctly | §6 `<bdi>` wrapping; §8 Pitfall 4 |
| **I18N-07** | Kickoff times in viewer's local TZ via native `Intl.DateTimeFormat` | §6 `useFormatter()` from next-intl; §10 Code Examples |
| **AUTH-01** | Join page accepts shared invite code | §5 Server Action sequence; §10 Code Examples (`joinPool` action) |
| **AUTH-02** | Valid code → `signInAnonymously()` + `profiles` row insert | §5 Server Action sequence; §10 Code Examples |
| **AUTH-03** | Display names unique + server-validated + XSS-safe | §3 Schema (display_name_normalized); §5 Zod schema; §8 Pitfall 7 |
| **AUTH-04** | Session persists across refresh and days on same device | §5 `@supabase/ssr` middleware refresh; §8 Pitfall 8 (device-locked tradeoff) |
| **AUTH-05** | No profile → redirected to `/[locale]/join` | §5 `requireMember()` helper; §10 Code Examples (root middleware redirect) |
| **AUTH-06** | Admin-only routes server-gated (deviation: `/admin/...` unlocalized) | §5 Admin bootstrap + `app/admin/layout.tsx` gate; §10 Code Examples |
| **AUTH-07** | Rate-limited / brute-force-resistant invite code | §5 Built-in Supabase 30/hr/IP cap (per D-02 reinterpretation); §8 Pitfall 9 |
| **DATA-01** | 48 WC 2026 teams seeded with `name_en`, `name_he`, ISO, group | §3 Schema (`teams` table); §9 WC 2026 Data (4-team groups confirmed) |
| **DATA-02** | 104 fixtures seeded with `timestamptz` kickoff, stage, group, placeholders | §3 Schema (`fixtures` table); §9 WC 2026 Data (104 = 72 group + 32 knockout) |
| **DATA-03** | Bracket slot graph seeded (R32 → Champion) | §3 Schema (`bracket_slots`); §9 Slot graph composition |
| **DATA-04** | Hebrew team names native-speaker reviewed pre-distribution | §9 Hebrew sourcing strategy; §8 Pitfall 10 |
| **DATA-05** | ~5–10 tournament-level prop questions with bilingual prompts + answer types | §3 Schema (`prop_questions`); §10 Code Examples |
| **VIS-06** | RLS uses `(select auth.uid())`; verified via unauthenticated curl | §4 RLS policies; §8 Pitfall 1; §10 Code Examples (curl verification script) |
</phase_requirements>

## Summary

Phase 1 is foundation-only — no feature surface ships, but every Phase 2+ feature depends on getting this right. The stack is locked (Next.js 15.5 + Tailwind v4.3 + Supabase + next-intl v4 + Vercel) and every recommendation in this document is verified against official 2026 sources. There are no novel technical unknowns; this is mechanical execution of well-documented patterns with one judgment call (generated column vs functional index for `display_name_normalized`).

The single highest-leverage technical artifact is **the RLS policy suite** — `predictions_read`, `predictions_write_insert`, `predictions_write_update`, `predictions_write_delete`, and analogous policies on `prop_answers` and `bracket_picks`. These policies enforce both **lock-on-kickoff** (writes rejected when `fixtures.kickoff_at <= now()`) and **visibility reveal** (reads of other users' rows allowed only after kickoff) — the database is the only enforcer; the app gets to be dumb. Every policy uses `(select auth.uid())` (not bare `auth.uid()`) per the post-CVE-2025-48757 best practice that has been documented as canonical since mid-2025 and remains so in 2026. The `predictions` table will have zero rows in Phase 1, but the RLS policies must be live from migration 0002 — Phase 2 must not touch them.

Two non-obvious decisions made by this research: (1) **use a generated column for `profiles.display_name_normalized`** (not a functional unique index) — Postgres 16 generated columns are STORED, indexable, and the `display_name → normalized` mapping is one-shot at write time; this is cleaner than recomputing in a functional index every time the planner thinks about uniqueness checks; (2) **`/api/heartbeat` should use the service-role key**, not a user session, because cron requests have no cookies — and verifying via Supabase logs (not Vercel function logs) is the spec because Supabase logs are the only proof that the query actually hit the DB rather than a Next.js fetch cache.

**Primary recommendation:** Build in this strict order — (1) Next scaffold + Tailwind + next-intl shell with `<html dir>` flipping correctly, (2) Supabase project + migration 0001 (tables) + migration 0002 (RLS) + manual curl verification, (3) seed migration 0003 (teams + fixtures + bracket_slots + props), (4) invite-code join Server Action + middleware refresh + admin gate, (5) Vercel Cron heartbeat, (6) Hebrew native-speaker review of seeded team names. Steps 1 and 2 must serialize; 3+4 can parallelize after 2 lands; 5+6 can land in parallel anytime after 3.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| **Next.js** | `15.5.x` | App Router, RSC, Server Actions, typed routes, Turbopack | LTS through Oct 21, 2026 — covers tournament. Next 16 introduces churn (`middleware.ts` → `proxy.ts`). 15.5 ships stable typed routes (`typedRoutes: true`) and globally-available `PageProps` types. |
| **React** | `19.x` | UI; `useActionState`, `<form action>` integration | Bundled with Next 15.5. Don't pin separately. |
| **TypeScript** | `5.5+` | Type safety, route typing | What `create-next-app` ships. Enable `typedRoutes: true`. |
| **Tailwind CSS** | `4.3.x` | Utility styling, logical-property RTL | v4.2+ ships complete logical-property utilities (`pbs-*`, `mbs-*`, `inset-s-*`, `inset-e-*`). **No `tailwindcss-rtl` plugin needed.** Note: `start-*`/`end-*` are deprecated in v4.2+ in favor of `inset-s-*`/`inset-e-*`. |
| **`@supabase/supabase-js`** | `^2.45+` | Postgres client, Auth SDK | Peer dep of `@supabase/ssr`. |
| **`@supabase/ssr`** | `^0.5+` | Cookie-based session for App Router (server components, route handlers, middleware) | **Only correct package for App Router.** `@supabase/auth-helpers-nextjs` is deprecated. |
| **`next-intl`** | `^4.x` | Locale routing, RSC translations, plural rules, ICU formatting | App Router-native. ~2KB runtime. `getTranslations()` (server) + `useTranslations()` (client). Built-in middleware for locale detection. |
| **Zod** | `^4.x` | Schema validation — shared client + server + DB | v4 stable; smaller bundle and faster type-check than v3. Share schemas between Server Action and Zod resolver. |
| **Vercel** | Hobby plan | Deploy, edge functions, image opt, cron | Native Next integration. Free Cron (1 job on Hobby — uses our heartbeat). 10s function timeout (irrelevant at CRUD load). |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **`@hookform/resolvers`** | `^3.10+` | Bridge Zod 4 ↔ React Hook Form | Required if any Phase-1 form uses RHF. **Phase 1's only forms are 1-field (invite code + display name) → prefer plain `<form action={serverAction}>` + `useActionState`. RHF lands in Phase 2 for the multi-fixture matchday form.** |
| **`clsx` + `tailwind-merge`** | latest | Conditional class composition | Optional. Common Tailwind hygiene. Tiny. |
| **Supabase CLI** | latest | Local DB, migrations, `gen types` | Dev-only. `npx supabase gen types typescript --linked > src/types/supabase.ts` after every schema change. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Next.js 15.5 | Next.js 16 | After the tournament. 15.5 is LTS, no upgrade pressure. |
| Tailwind v4 + logical | `tailwindcss-rtl` plugin | Plugin is **legacy** as of v4. Use only if stuck on Tailwind v3. |
| `next-intl` v4 | Hand-rolled JSON dictionary | Acceptable only for <30 strings + no plural rules. We have plurals + date formatting + locale routing — don't roll your own. |
| Native `Intl.DateTimeFormat` | `date-fns@^4` + `date-fns-tz` | Skip — Phase 1 only needs formatting (no arithmetic). |
| `signInAnonymously()` | Magic-link / OAuth / Clerk | Locked decision (D-01). Re-litigation forbidden. |
| Generated column for `display_name_normalized` | Functional unique index `unique (lower(trim(normalize(display_name, NFC))))` | Generated column is cleaner — index is on a real column, not an expression; Postgres 16 STORED generated columns are eagerly computed at write, making conflict errors immediate and predictable. |

**Installation (canonical for Phase 1):**

```bash
# Bootstrap
npx create-next-app@latest zarur-cup \
  --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
cd zarur-cup

# Core
npm install @supabase/supabase-js @supabase/ssr next-intl zod

# Optional ergonomics
npm install clsx tailwind-merge

# Dev / Supabase CLI
npm install -D supabase
```

Required `package.json` scripts:

```json
{
  "scripts": {
    "db:types": "supabase gen types typescript --linked > src/types/supabase.ts",
    "db:reset": "supabase db reset --linked",
    "lint:rtl": "grep -REn '\\b(p|m|border|rounded)[lr]-|\\btext-(left|right)\\b|\\b(left|right)-[0-9]' src/ && exit 1 || exit 0"
  }
}
```

## Architecture Patterns

### Recommended Project Structure

```
src/
├── app/
│   ├── [locale]/                          # i18n routing root
│   │   ├── layout.tsx                     # <html lang dir>, NextIntlProvider, font swap
│   │   ├── page.tsx                       # Landing (placeholder for Phase 2)
│   │   ├── join/page.tsx                  # Invite-code + display-name form (Phase 1)
│   │   ├── matches/page.tsx               # Placeholder "predictions open Phase 2"
│   │   ├── bracket/page.tsx               # Placeholder "available Phase 3"
│   │   ├── leaderboard/page.tsx           # Placeholder "available Phase 2"
│   │   └── me/page.tsx                    # Display name, locale toggle, joined-at
│   ├── admin/                             # UNLOCALIZED per D-05
│   │   ├── layout.tsx                     # requireAdmin() server gate
│   │   └── page.tsx                       # Placeholder for Phase 2 admin pages
│   ├── actions/
│   │   ├── join.ts                        # 'use server' — invite-code + signInAnonymously + profile insert
│   │   └── locale.ts                      # 'use server' — switch locale (cookie + profiles.locale)
│   ├── api/
│   │   └── heartbeat/route.ts             # Vercel Cron target (FND-05)
│   └── globals.css                        # Tailwind base + font CSS variables
├── components/
│   ├── ui/                                # Buttons, inputs, Toast
│   ├── layout/
│   │   ├── Header.tsx                     # Wordmark + LocaleTogglePill
│   │   ├── LocaleTogglePill.client.tsx    # 'use client'
│   │   ├── BottomTabBar.tsx               # 4 tabs; flex order auto-flips via <html dir>
│   │   └── Wordmark.tsx                   # he/en variant
│   └── auth/
│       └── JoinForm.client.tsx            # 'use client' for useActionState UX
├── lib/
│   ├── supabase/
│   │   ├── server.ts                      # createServerClient (RSC + Server Actions)
│   │   ├── client.ts                      # createBrowserClient (client islands)
│   │   ├── middleware.ts                  # Cookie refresh helper for middleware.ts
│   │   └── service.ts                     # Service-role client (heartbeat + future admin actions)
│   ├── auth/
│   │   ├── session.ts                     # getCurrentMember(), requireMember(), requireAdmin()
│   │   └── invite.ts                      # Server-side helper called by actions/join.ts
│   ├── schemas/
│   │   ├── displayName.ts                 # Zod schema shared by client + server
│   │   └── join.ts                        # invite_code + display_name + locale
│   ├── i18n/
│   │   ├── routing.ts                     # defineRouting({locales:['he','en'], defaultLocale:'he'})
│   │   └── request.ts                     # next-intl getRequestConfig
│   └── time/
│       └── format.ts                      # Wrapper around Intl.DateTimeFormat / next-intl useFormatter
├── messages/
│   ├── he.json
│   └── en.json
├── types/
│   └── supabase.ts                        # Generated by supabase CLI
├── middleware.ts                          # next-intl middleware + Supabase session refresh
└── supabase/
    ├── config.toml                        # Supabase CLI config (gitignored secrets)
    ├── migrations/
    │   ├── 0001_init.sql                  # Tables + indexes
    │   ├── 0002_rls.sql                   # RLS enable + policies (all 9 tables)
    │   ├── 0003_seed_wc2026.sql           # 48 teams + 104 fixtures + bracket_slots + tournament row
    │   └── 0004_seed_props.sql            # DATA-05 prop questions (admin-authored bilingual)
    └── tests/
        └── rls_verify.sql                 # Curl-equivalent assertions for VIS-06
```

### Pattern 1: Server-First with RLS as the Sole Enforcer

**What:** RSC pages hit Postgres directly via `lib/db/*` helpers; Server Actions handle every write; client components are reserved for genuinely interactive surfaces (`LocaleTogglePill`, `JoinForm` with `useActionState`). RLS policies (not app code) enforce both visibility and lock semantics.

**When to use:** Always. Phase 1 has only one Server Action (`joinPool`), but the pattern is canonical for the project.

**Example:**

```typescript
// Source: https://supabase.com/docs/guides/auth/server-side/nextjs
// src/lib/supabase/server.ts
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options));
          } catch {
            // Called from a Server Component — middleware will refresh on next request
          }
        },
      },
    }
  );
}
```

### Pattern 2: Lock-and-Reveal RLS (single source of truth)

**What:** One `predictions_read` policy widens at `kickoff_at <= now()` — no separate "private vs public" table split. Writes are gated by the same predicate in `WITH CHECK`. Late joiners are gated by the same kickoff predicate, so no special-case code.

**When to use:** Every table whose visibility depends on a moment in time (predictions, prop_answers, bracket_picks).

**Critical detail:** Knockout fixtures whose `home_placeholder = 'WINNER_GROUP_A'` (and `home_team_id IS NULL`) are gated by `kickoff_at`, not team identity. The policy never references `home_team_id` / `away_team_id`, so placeholder fixtures behave exactly like regular fixtures.

```sql
-- Source: https://supabase.com/docs/guides/database/postgres/row-level-security
-- + https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv
alter table predictions enable row level security;

-- READ: your own rows always; everyone's rows after kickoff
create policy predictions_read on predictions
  for select to authenticated using (
    user_id = (select auth.uid())
    or exists (
      select 1 from fixtures f
      where f.id = predictions.fixture_id and f.kickoff_at <= now()
    )
  );

-- INSERT: must be your row; fixture must not have started
create policy predictions_insert on predictions
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from fixtures f
      where f.id = fixture_id and f.kickoff_at > now()
    )
  );

-- UPDATE: must be your row; fixture must not have started (both USING and WITH CHECK)
create policy predictions_update on predictions
  for update to authenticated
    using (user_id = (select auth.uid()))
    with check (
      user_id = (select auth.uid())
      and exists (
        select 1 from fixtures f
        where f.id = fixture_id and f.kickoff_at > now()
      )
    );

-- DELETE: must be your row; fixture must not have started
create policy predictions_delete on predictions
  for delete to authenticated using (
    user_id = (select auth.uid())
    and exists (
      select 1 from fixtures f
      where f.id = fixture_id and f.kickoff_at > now()
    )
  );
```

**Why `(select auth.uid())` and not bare `auth.uid()`:** Wrapping the function in a `select` causes the Postgres planner to run it as an `InitPlan` — cached once per statement instead of re-executed per row. This is the documented best practice from Supabase since mid-2025 and is the post-CVE-2025-48757 standard. See [Supabase RLS performance and best practices](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv) and the [`auth_rls_initplan` advisor lint](https://supabase.com/docs/guides/database/database-advisors?queryGroups=lint&lint=0003_auth_rls_initplan).

**Why `to authenticated` and not `to public`:** Restricts the policy to authenticated roles, so anon callers don't even attempt evaluation (returns zero rows immediately). Defense in depth + cheap perf win.

**Late-entrant interaction (D-11):** The policy gates on `fixtures.kickoff_at > now()`, so a user who joined on June 14 trying to insert a prediction for a June 11 fixture is rejected by the same RLS rule that protects everyone else. No `profiles.joined_at` reference is needed in the policy itself. **Confirmed clean.**

### Pattern 3: Bilingual Content Split — Repo Strings vs DB Domain Text

**What:** UI chrome (buttons, errors, headers) lives in `messages/{he,en}.json` consumed by next-intl. Domain text (team names, prop prompts) lives in DB columns suffixed `_he` / `_en`. Pages select the locale-appropriate column based on the URL segment.

**When to use:** Always. Phase 1's `teams.name_he` / `teams.name_en` and `prop_questions.prompt_he` / `prompt_en` are the DB side.

```typescript
// Source: project pattern — Architecture.md §"Bilingual Content Split"
// Inside a Server Component
const { data } = await supabase
  .from('teams')
  .select(`id, code, ${locale === 'he' ? 'name_he' : 'name_en'} as name`)
  .order('group_code');
```

### Anti-Patterns to Avoid

- **Enforcing lock only in the Server Action:** `if (fixture.kickoff_at <= new Date()) throw` is bypassable by any forgotten code path. RLS `WITH CHECK` is the only enforcer. App code mirrors the predicate for UI affordance.
- **A separate `predictions_private` / `predictions_public` table:** Doubles storage, adds a scheduler dependency, two sources of truth. One table, one widening `USING` clause.
- **`translations(table, row_id, locale, value)` join table for team names:** Every team query becomes a join. Type safety vanishes. The benefit (add languages later) is irrelevant when the spec has exactly two locales.
- **Fake emails (`displayname@invite.local`) + `signUp({email, password})` to "use Supabase Auth properly":** Pollutes `auth.users` with bogus emails, creates a confirmation-flow trap, doesn't enforce the invite gate. Use `signInAnonymously()` + invite gate. This is the locked decision.
- **`getSession()` in server code:** Trusts cookies; can return a stale session that survived a sign-out elsewhere. Use `getClaims()` for auth verification; `getUser()` only when you need the most up-to-date user record from the Auth server.
- **Tailwind physical utilities (`pl-`, `pr-`, `ml-`, `mr-`, `text-left`, `border-l-`, `left-`, `right-`):** Don't flip in RTL. Use logical equivalents. **Phase 1 ships the CI lint rule that blocks these (FND-03).**

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Locale routing + browser detection | Custom path parser + `Accept-Language` matcher | next-intl v4 middleware with `localeDetection: true` + `defaultLocale: 'he'` | next-intl uses `@formatjs/intl-localematcher` best-fit algorithm. Hand-rolling means re-implementing BCP 47 matching. Days of work for no gain. |
| Cookie session refresh in middleware | Custom JWT decode + refresh-token rotation | `@supabase/ssr` `createServerClient` in `middleware.ts` | Token rotation is fragile; the SSR package handles `Set-Cookie` correctly and intercepts refreshed cookies into the response. |
| Display-name uniqueness (case + trim + NFC) | Application-layer `lower(trim(normalize))` + pre-insert check | Postgres generated column `display_name_normalized` with unique index | Race conditions: two clients submit identical normalized names ms apart. Only a DB unique constraint is safe. |
| ICU plural rules and date formatting | Hand-coded `${n} match${n !== 1 ? 'es' : ''}` strings | next-intl `useTranslations()` ICU syntax + `useFormatter()` for dates | Hebrew has dual/plural distinctions Latin doesn't ("שתי" vs "שלוש"). ICU handles this. |
| RTL flipping for spacing/positioning | Conditional `dir === 'rtl' ? 'pl-4' : 'pr-4'` in className | Tailwind v4 logical properties (`ps-4`, `pe-4`, `inset-s-0`, `inset-e-4`) | One source of truth; CSS flips via the `<html dir>` attribute. No conditional className. |
| Locale-aware date / time format | Custom `formatHebrewDate()` | Native `Intl.DateTimeFormat` (wrapped by next-intl `useFormatter`) | Hebrew month names, 24h format, BiDi numerals all handled. |
| Anonymous auth → profile binding | Custom `auth_session` table + cookie | Supabase `signInAnonymously()` + `profiles` row keyed on `auth.uid()` | RLS-via-JWT integration is the whole reason for using Supabase Auth. |
| Mixed-direction text in scores ("2 - 1" in Hebrew) | LRM/RLM control characters | `<bdi>` wrapper or `<span dir="ltr">` | Standard HTML primitives; semantic; no invisible characters in your strings. |
| Free-tier project keepalive | Custom polling from your laptop | Vercel Cron → `/api/heartbeat` → real `select` on Supabase | Built into Hobby plan. One cron job per project on Hobby — that's our heartbeat. |

**Key insight:** Phase 1 is foundation, not innovation. Every problem in this phase has a standard 2026 solution. The temptation to "wire it up by hand" usually costs more time than reading the docs.

## Common Pitfalls

### Pitfall 1: RLS missing on a Phase-1 table = data leak from day 1

**What goes wrong:** A new table is created with `create table` but the developer forgets `alter table … enable row level security`. The default is RLS-disabled — meaning the table is fully readable via the anon key (which is bundled in the browser). CVE-2025-48757 (May 2025) found ~10% of generated Supabase apps shipped this exact flaw. Even worse: a table with RLS enabled but **no policies** returns *zero* rows — but a table with `enable row level security` *not* called returns *all* rows.

**Why it happens:** The Supabase table-editor in the dashboard now defaults to RLS-on, but `create table` in a migration does not. Migrations are where this leaks.

**How to avoid:**
- Every `create table` in `0001_init.sql` is immediately followed in `0002_rls.sql` by `alter table <name> enable row level security` **plus** at least one explicit policy (even if the policy is `using (false)` for tables with no read use yet).
- Add a smoke test to migration 0002: `select tablename from pg_tables where schemaname='public' and rowsecurity = false;` should return zero rows.
- VIS-06's curl verification (from a logged-out terminal): `curl https://<deploy>/rest/v1/predictions?select=*` with only the publishable key returns `[]`.

**Warning signs:** A SELECT against the table from the anon client returns rows when it shouldn't. The `pg_tables.rowsecurity` flag is false for any public table.

### Pitfall 2: Client-side lock checking (UI affordance ≠ enforcement)

**What goes wrong:** Submit button disabled at kickoff in the UI, but a user with two tabs (one opened pre-kickoff) submits at kickoff+30s, or curls the REST endpoint, and the write succeeds because no server lock exists.

**How to avoid:** RLS `WITH CHECK ((select kickoff_at from fixtures where id = fixture_id) > now())` on INSERT, UPDATE, and DELETE policies (the policies in Pattern 2 above). App-level checks are UX affordance only.

**Daily integrity query** (for Phase 2 admin dashboard, but worth building the SQL in Phase 1):
```sql
select count(*) from predictions p
  join fixtures f on f.id = p.fixture_id
  where p.submitted_at > f.kickoff_at;
-- must always return 0
```

### Pitfall 3: `timestamptz` confusion at seed time

**What goes wrong:** Migration 0003 seeds a fixture as `INSERT INTO fixtures (..., kickoff_at) VALUES (..., '2026-06-11 11:00:00')`. Postgres interprets the string in the session timezone (often UTC on Supabase, but the seed file might have been authored in Israel). The fixture displays at the wrong time; the lock fires at the wrong moment.

**How to avoid:**
- Every kickoff time in the seed is **explicitly UTC**: `'2026-06-11 20:00:00+00'` (or `'2026-06-11T20:00:00Z'`).
- All columns are `timestamptz`, never `timestamp`. Add a grep check to CI on migrations: `grep -nE '\btimestamp\b\s+(?!with time zone)' supabase/migrations/`.
- The 2026 host countries (USA, Mexico, Canada) span UTC-4 through UTC-7. Authoring the kickoff_at in any of those zones is wrong. **Always store UTC.**

### Pitfall 4: Hydration mismatch from client-side locale detection

**What goes wrong:** `<html dir="...">` is set from `navigator.language` in a `useEffect`, causing a layout flash from LTR → RTL on first render in Hebrew. React also throws a hydration mismatch warning because server-rendered HTML had `dir="ltr"` and client-replaced it with `dir="rtl"`.

**How to avoid:**
- `<html lang dir>` is set in `app/[locale]/layout.tsx` from the URL segment (`params.locale`). This is server-rendered with the correct value before first paint.
- next-intl middleware handles the initial `/` → `/he/` or `/en/` redirect (based on `Accept-Language`) before any React renders.
- The locale toggle (D-17) navigates to a new URL (`/he/foo` → `/en/foo`), causing a full re-render with the correct `dir`. No client-side `dir` mutation.

### Pitfall 5: Service-role key leaking into client bundle

**What goes wrong:** A developer imports `SUPABASE_SECRET_KEY` in a server-side file that gets accidentally included in a client component bundle (e.g., a `lib/db` helper that exports both server and client utilities). The secret key bypasses ALL RLS and ends up shipped to every browser.

**How to avoid:**
- `lib/supabase/service.ts` is the **only** file that reads `SUPABASE_SECRET_KEY`. It exports a `createServiceClient()` that's only callable from `app/api/heartbeat/route.ts` and (future) admin Server Actions.
- Lint rule: `grep -r 'SUPABASE_SECRET_KEY' src/` should match only `lib/supabase/service.ts` and possibly `app/api/heartbeat/`.
- The env var name has no `NEXT_PUBLIC_` prefix, so even if it's imported into a client component, Next.js won't expose it — but the build still fails if someone tries.

### Pitfall 6: Supabase free-tier auto-pause within the 19-day pre-tournament window

**What goes wrong:** Project provisioned May 23. If no DB queries happen for 7 days, Supabase pauses the project. If the family is told about the URL early but doesn't use it, the project could be paused right before June 11.

**How to avoid:** Vercel Cron pings `/api/heartbeat` every 3 days. The route handler executes a **real DB query** (`select id from fixtures limit 1`) using the service-role key. Verify pings via Supabase project logs (Postgres logs → look for the SELECT statement). **Verifying via Vercel function logs is theater** — that proves the function ran, not that the DB was queried.

**Single cron job limit on Hobby:** Vercel Hobby allows only 1 cron job. This is the one. Don't burn it on anything else.

### Pitfall 7: Display-name normalization race condition

**What goes wrong:** Two users submit "dani" and "Dani " (trailing space) within milliseconds. Both pass app-layer uniqueness checks ("no existing row matches"). Both INSERTs hit Postgres; the second one silently succeeds because the app-layer check raced. Family has two "Dani" rows in `profiles`, leaderboard ambiguous.

**How to avoid:** Postgres generated column with a unique index is the only safe enforcement.
```sql
alter table profiles
  add column display_name_normalized text generated always as
    (lower(trim(normalize(display_name, NFC)))) stored;
create unique index profiles_display_name_normalized_uniq
  on profiles (display_name_normalized);
```
The Server Action catches the `23505 unique_violation` and returns the localized "name taken" error via `useActionState`.

### Pitfall 8: Anonymous session device-lock (accepted tradeoff)

**What goes wrong:** Cousin Dani signs in on his phone, picks predictions. Next day his phone clears cookies (browser quota, manual clean, switch to a different browser). He visits the URL again; gets a new anonymous user UUID; sees no predictions.

**Accepted by D-01 and PROJECT.md.** Phase 1 covers this with: (a) clear onboarding microcopy ("This device remembers you — pick the device you'll use for the tournament"); (b) `profiles` table supports admin "merge users" in Phase 2 (ADM-05); (c) `persistSession: true` is default in `@supabase/supabase-js` so cookies survive indefinitely as long as the user doesn't clear them.

### Pitfall 9: Invite-code abuse (deliberate non-mitigation)

**What goes wrong:** Someone discovers the URL and tries random invite codes.

**Accepted by D-02.** Supabase rate-limits anonymous sign-ins to 30/hr/IP — that's the only defense in v1. No Turnstile, no per-IP attempt table. **Document this clearly in AUTH-07's traceability note.** If abuse becomes a real problem, add Cloudflare Turnstile (free) to the join form — a one-day retrofit.

### Pitfall 10: Hebrew team-name typos surviving to launch

**What goes wrong:** Team names in `name_he` are seeded from a JSON file authored by the developer (English-first). Some names have wrong vowels, transliteration choices that read awkwardly, or rare-country names that the developer guessed. Family member opens the app, sees "ארגנטיב" (typo for "ארגנטינה" — Argentina), trust drops.

**How to avoid:** DATA-04 mandates a Hebrew native-speaker review **before** the family invite code is distributed. This happens **inside Phase 1** per D-22 (not Phase 2's broader QA-03 copy review). The schema/seed sign-off depends on it.

**Sourcing strategy:** No canonical FIFA Hebrew JSON exists. Manual curation from a known WC 2026 team list + Wikipedia Hebrew article cross-check + native-speaker review pass. Build the seed file as a CSV / TS const, not embedded SQL — easier to diff and review.

## Code Examples

Verified patterns from official sources.

### `middleware.ts` — next-intl + Supabase session refresh combined

```typescript
// Source: https://next-intl.dev/docs/routing/middleware
// + https://supabase.com/docs/guides/auth/server-side/nextjs
import { NextRequest, NextResponse } from 'next/server';
import createIntlMiddleware from 'next-intl/middleware';
import { createServerClient } from '@supabase/ssr';
import { routing } from '@/lib/i18n/routing';

const intlMiddleware = createIntlMiddleware(routing);

export async function middleware(request: NextRequest) {
  // 1. Run next-intl first — handles /he/ /en/ routing + Accept-Language detection
  const response = intlMiddleware(request);

  // 2. Refresh Supabase session cookies on the response from step 1
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options));
        },
      },
    }
  );

  // Triggers refresh-token rotation if access token is near expiry
  await supabase.auth.getClaims();

  return response;
}

export const config = {
  // Match everything except api, _next, _vercel, and files with dots (assets)
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
```

### `lib/i18n/routing.ts` — locale config

```typescript
// Source: https://next-intl.dev/docs/routing/configuration
import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['he', 'en'],
  defaultLocale: 'he',
  localeDetection: true, // Accept-Language matching enabled
  localePrefix: 'always', // /he/foo and /en/foo, never bare /foo
});
```

### `app/[locale]/layout.tsx` — `<html dir>` set server-side

```tsx
// Source: https://next-intl.dev/docs/getting-started/app-router/with-i18n-routing
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Heebo, Inter } from 'next/font/google';
import { routing } from '@/lib/i18n/routing';

const heebo = Heebo({
  subsets: ['hebrew', 'latin'],
  weight: ['400', '700'],
  variable: '--font-heebo',
  display: 'swap',
});
const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-inter',
  display: 'swap',
});

type Props = { children: React.ReactNode; params: Promise<{ locale: string }> };

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;
  if (!routing.locales.includes(locale as 'he' | 'en')) notFound();

  const dir = locale === 'he' ? 'rtl' : 'ltr';
  const messages = await getMessages();

  return (
    <html lang={locale} dir={dir} className={`${heebo.variable} ${inter.variable}`}>
      <body className={locale === 'he' ? 'font-heebo' : 'font-inter'}>
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
```

### Header pill locale toggle with `inset-e-*` (Tailwind v4.3)

```tsx
// Source: https://tailwindcss.com/blog/tailwindcss-v4-3
// inset-e-4 = inset-inline-end:1rem → right:1rem in LTR, left:1rem in RTL
import { Link } from '@/lib/i18n/routing';
import { usePathname, useParams } from 'next/navigation';

export function LocaleTogglePill() {
  const pathname = usePathname();
  const { locale } = useParams<{ locale: 'he' | 'en' }>();
  const otherLocale = locale === 'he' ? 'en' : 'he';
  return (
    <Link
      href={pathname}
      locale={otherLocale}
      className="absolute inset-be-3 inset-e-4 rounded-full bg-stone-900 text-stone-50 ps-3 pe-3 pbs-1 pbe-1 text-sm"
    >
      {locale === 'he' ? 'EN' : 'HE'}
    </Link>
  );
}
```

**Logical-property notes:** `inset-e-4` flips automatically based on `<html dir>` — no conditional className. `ps-3 pe-3 pbs-1 pbe-1` is the v4.3 equivalent of `px-3 py-1` but logical (block-start/end + inline-start/end).

### `actions/join.ts` — invite-code Server Action

```typescript
// Source: project synthesis; verified against
// https://supabase.com/docs/guides/auth/auth-anonymous
// + https://supabase.com/docs/guides/auth/server-side/nextjs
'use server';

import { z } from 'zod';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getLocale } from 'next-intl/server';

const joinSchema = z.object({
  invite_code: z.string().min(1),
  display_name: z
    .string()
    .trim()
    .min(2)
    .max(24)
    .regex(/^[\p{L}\d ]+$/u, 'invalid_chars'), // Hebrew/Latin letters + digits + spaces
});

export async function joinPool(_prev: unknown, formData: FormData) {
  const locale = await getLocale();
  const parsed = joinSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: 'validation_failed', issues: parsed.error.issues };

  const { invite_code, display_name } = parsed.data;

  // 1. Check invite code (server-side env var, never to client)
  if (invite_code !== process.env.INVITE_CODE) {
    return { error: 'invalid_code' };
  }

  const supabase = await createClient();

  // 2. Anonymous sign-in. Sets auth cookies on the response.
  const { data: signIn, error: signInErr } = await supabase.auth.signInAnonymously();
  if (signInErr || !signIn.user) return { error: 'auth_failed' };

  // 3. Determine admin status. Normalize same way as display_name_normalized.
  const normalized = display_name.trim().normalize('NFC').toLowerCase();
  const adminNormalized = process.env.ADMIN_DISPLAY_NAME?.trim().normalize('NFC').toLowerCase();
  const isAdmin = !!adminNormalized && normalized === adminNormalized;

  // 4. Insert profile row keyed on auth.uid()
  const { error: profileErr } = await supabase.from('profiles').insert({
    user_id: signIn.user.id,
    display_name, // preserves casing
    locale,
    is_admin: isAdmin,
  });
  if (profileErr) {
    // 23505 unique_violation on display_name_normalized
    if (profileErr.code === '23505') return { error: 'display_name_taken' };
    return { error: 'profile_failed' };
  }

  // 5. Redirect to the localized home (Phase 2 will redirect to /matches)
  redirect(`/${locale}`);
}
```

### `app/api/heartbeat/route.ts` — Vercel Cron target

```typescript
// Source: project synthesis; verified against https://vercel.com/docs/cron-jobs
// + https://supabase.com/docs/guides/database/connecting-to-postgres/serverless-drivers
import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';

export const dynamic = 'force-dynamic'; // Never cached

export async function GET() {
  const supabase = createServiceClient();
  // MUST be a real DB query — verifiable via Supabase Postgres logs
  const { error } = await supabase.from('fixtures').select('id').limit(1);
  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true, pinged_at: new Date().toISOString() });
}
```

### `vercel.json` — cron schedule

```json
{
  "crons": [
    {
      "path": "/api/heartbeat",
      "schedule": "0 12 */3 * *"
    }
  ]
}
```

**Schedule meaning:** at 12:00 UTC every 3 days. That's ~10 pings in the 19-day pre-tournament window. Well under Supabase's 7-day inactivity threshold.

### `lib/supabase/service.ts` — service-role client (heartbeat-only)

```typescript
// Source: https://supabase.com/docs/guides/auth/server-side/creating-a-client
import { createClient } from '@supabase/supabase-js';

export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
```

### `lib/auth/session.ts` — auth helpers

```typescript
// Source: project synthesis
// + https://supabase.com/docs/reference/javascript/auth-getclaims
import 'server-only';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export async function getCurrentMember() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('user_id, display_name, locale, is_admin, joined_at')
    .eq('user_id', claims.claims.sub)
    .single();
  return profile;
}

export async function requireMember(locale: string) {
  const member = await getCurrentMember();
  if (!member) redirect(`/${locale}/join`);
  return member;
}

export async function requireAdmin() {
  const member = await getCurrentMember();
  if (!member || !member.is_admin) redirect('/');
  return member;
}
```

### Curl verification script for VIS-06

```bash
# Run from a logged-out terminal. Must return [] (empty array).
# Source: project synthesis; verifies CVE-2025-48757-class read-leak does NOT exist
curl -s -X GET "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/predictions?select=*" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY" \
  -H "Authorization: Bearer $NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
# Expected output: []
```

## State of the Art

| Old Approach | Current Approach (2026) | When Changed | Impact |
|--------------|--------------------------|--------------|--------|
| `@supabase/auth-helpers-nextjs` | `@supabase/ssr` | Late 2024 — auth-helpers archived | All Phase-1 imports use `@supabase/ssr`. Old tutorials still show auth-helpers. |
| Bare `auth.uid()` in RLS | `(select auth.uid())` | Mid-2025, hardened by CVE-2025-48757 (May 2025) | Performance + readability. `auth_rls_initplan` advisor lint flags violations. |
| `getSession()` for server auth check | `getClaims()` (preferred) or `getUser()` | 2025 — `getClaims()` shipped | `getClaims()` validates JWT against JWKS (often cached) without round-tripping to the Auth server. `getUser()` is the fallback for "I need the freshest user state." |
| Legacy Supabase keys (`anon` / `service_role`) | New keys (`sb_publishable_*` / `sb_secret_*`) | 2025 — overlap through end of 2026 | Legacy still works through Dec 2026 but Phase 1 should provision new format from the start. |
| `tailwindcss-rtl` plugin | Tailwind v4.3 logical-property utilities (`ps-*`, `pe-*`, `inset-s-*`, `inset-e-*`) | v3.3 (2023) for the basics; v4.2 (2026) added the complete set | No plugin install. v4.2+ also deprecated `start-*` / `end-*` in favor of `inset-s-*` / `inset-e-*` for API consistency. |
| `next lint` CLI | Direct `eslint` invocation (flat config in `eslint.config.mjs`) | 15.5 deprecated; removed in 16 | `create-next-app@latest` generates the flat config automatically. Don't customize on this timeline. |
| `legacyBehavior` on `<Link>` | Modern `<Link href="...">children</Link>` | Removed in Next 16 | We're on 15.5 but should write modern syntax. |
| Pages Router | App Router with `src/app/[locale]/...` | Pages Router in maintenance mode | Required. |
| `next-i18next` | `next-intl@^4` | next-i18next is still primarily Pages-Router | next-intl is the App-Router native default. |

**Deprecated / outdated:**
- **`@supabase/auth-helpers-nextjs`:** archived. Use `@supabase/ssr`.
- **Tailwind `start-*` / `end-*` positioning utilities:** deprecated in v4.2+. Use `inset-s-*` / `inset-e-*`.
- **`getSession()` for protecting server-side data:** doesn't revalidate JWT. Use `getClaims()` (preferred) or `getUser()` (for freshest state).
- **`new Date(kickoff_at).getTime() < Date.now()` for lock decisions:** client clock cannot be trusted. Server is the only clock; RLS is the lock.
- **Hand-rolled invite-code "session" cookies:** use `signInAnonymously()`. Supabase's anonymous-auth primitive is the designed solution.

## Open Questions

### Question 1: Bracket slot graph — one table or two?

- **What we know:** Decisions D-19/D-22 mandate "bracket slot graph (R32 → R16 → QF → SF → F + Champion) fully populated." The architecture research §"Schema Sketch" uses one `bracket_slots` table with `slot_code`, `stage`, `fixture_id` (nullable). The "Claude's Discretion" section of CONTEXT.md explicitly defers this.
- **What's unclear:** Whether to also include an adjacency table (`bracket_slot_edges(from_slot_id, to_slot_id)`) to model the winner-feeds-into relationship explicitly.
- **Recommendation:** **One table** for Phase 1. Add `parent_slot_id uuid references bracket_slots(id)` column to `bracket_slots` for the winner-feeds-into relationship (NULL for Champion). Adjacency edges as a separate table is overkill for 31 slots with a tree (not graph) structure. Phase 3's bracket-scoring planner can add a denormalized table if perf needs it.

### Question 2: Cron heartbeat response — JSON body or 204?

- **What we know:** D-18 explicitly defers this to planner discretion.
- **Recommendation:** **Return `{ ok: true, pinged_at: <ISO> }` JSON.** Reasons: (a) easier debugging — Vercel's cron logs show the response body; (b) future-proof if someone curls `/api/heartbeat` to check liveness; (c) cost is negligible (~50 bytes). The body is also a small defense-in-depth signal that the route ran the DB query (the `pinged_at` proves the function executed and the lack of an `error` field proves the DB query succeeded).

### Question 3: Hebrew team-name reviewer — who and when?

- **What we know:** DATA-04 mandates native-speaker review inside Phase 1; STATE.md flags this as an open question; no reviewer identified in CONTEXT.md.
- **Recommendation:** **The Phase 1 planner should explicitly call out this dependency in its plan.** The native-speaker can be a family member; the review is a 30-minute pass over a CSV of 48 team names. Block the Phase 1 ship-gate on this signoff. The DB seed should be authored such that re-running migration 0003 with corrected names is idempotent (which it is — INSERTs into `teams` will conflict on `(tournament_id, code)` unique index, planner should make the seed use ON CONFLICT DO UPDATE).

### Question 4: 8 best third-placed teams algorithm — Phase 1 or Phase 2?

- **What we know:** WC 2026's expanded format means 32 teams reach R32: 12 group winners + 12 runners-up + **8 best third-placed teams** (computed from twelve groups' third-place finishers). The R32 fixtures need symbolic placeholders for the 8 "best 3rd-place" slots (`THIRD_PLACE_1`..`THIRD_PLACE_8`).
- **What's unclear:** Whether Phase 1 seeds the 8 placeholder fixtures with symbolic refs, leaving the resolution algorithm for Phase 2 admin tooling (ADM-03).
- **Recommendation:** **Seed the 8 placeholder slots in Phase 1.** The resolution algorithm (computing tiebreakers across twelve groups) lives in Phase 2 admin code. Phase 1's job is to make sure the schema and fixtures don't lie — the 32 R32 fixtures exist with their kickoff times and symbolic placeholders. Phase 2's `ADM-03` resolves them.

## Sources

### Primary (HIGH confidence)

- [Next.js 15.5 release blog](https://nextjs.org/blog/next-15-5) — version, LTS window, App Router status, typed routes, deprecations
- [Supabase Server-Side Auth (Next.js)](https://supabase.com/docs/guides/auth/server-side/nextjs) — `@supabase/ssr` package, `getClaims()` vs `getSession()`
- [Supabase Anonymous Sign-Ins](https://supabase.com/docs/guides/auth/auth-anonymous) — `signInAnonymously()`, `is_anonymous` JWT claim, device-locked sessions, 30/hr/IP rate limit
- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security) — USING vs WITH CHECK semantics, policy creation syntax
- [Supabase RLS performance and best practices](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv) — `(select auth.uid())` InitPlan caching, `to authenticated`, indexing FKs used in policies
- [Supabase auth_rls_initplan advisor lint](https://supabase.com/docs/guides/database/database-advisors?queryGroups=lint&lint=0003_auth_rls_initplan) — flags bare `auth.uid()` policies
- [Supabase `getClaims()` JS reference](https://supabase.com/docs/reference/javascript/auth-getclaims) — JWKS validation, signature check, why prefer over `getUser()`
- [Supabase Creating a Server-Side Client](https://supabase.com/docs/guides/auth/server-side/creating-a-client) — `createServerClient`, cookie handlers, service-role usage
- [Tailwind CSS v4.3 release](https://tailwindcss.com/blog/tailwindcss-v4-3) — logical properties (`inset-s-*` / `inset-e-*`), `start-*` / `end-*` deprecation
- [next-intl App Router setup](https://next-intl.dev/docs/getting-started/app-router) — locale routing, middleware
- [next-intl Routing middleware](https://next-intl.dev/docs/routing/middleware) — `localeDetection`, `localePrefix`, Accept-Language matching algorithm
- [next-intl Routing configuration](https://next-intl.dev/docs/routing/configuration) — `defineRouting`, `defaultLocale`
- [Vercel Cron Jobs docs](https://vercel.com/docs/cron-jobs) — `vercel.json` schema, Hobby plan 1-job limit, schedule format
- [2026 FIFA World Cup — Wikipedia](https://en.wikipedia.org/wiki/2026_FIFA_World_Cup) — 48 teams, 12 groups of 4, 104 matches, R32 stage, 8 best 3rd-place teams
- [FIFA World Cup 2026 official](https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/groups-how-teams-qualify-tie-breakers) — group format, tiebreakers, R32 advancement
- [Zod v4 release notes](https://zod.dev/v4) — Zod 4 stability, bundle size

### Secondary (MEDIUM confidence)

- [Supabase RLS in Production: Patterns That Actually Work — DEV](https://dev.to/whoffagents/supabase-row-level-security-in-production-patterns-that-actually-work-2l78) — corroborates official docs on `(select auth.uid())`
- [Supabase RLS: Common Mistakes — VibeAppScanner](https://vibeappscanner.com/supabase-row-level-security) — CVE-2025-48757 breakdown, common policy mistakes
- [Why Your Supabase Data Is Exposed — DEV](https://dev.to/jordan_sterchele/why-your-supabase-data-is-exposed-and-you-dont-know-it-25fh) — CVE-2025-48757 post-mortem class
- [Supabase RLS Best Practices: Production Patterns — Makerkit](https://makerkit.dev/blog/tutorials/supabase-rls-best-practices) — security-definer functions, `set search_path`
- [Tailwind CSS v3.3 logical properties](https://tailwindcss.com/blog/tailwindcss-v3-3) — origin of `ms-*` / `me-*` / `ps-*` / `pe-*`
- [Prevent Supabase Free Tier Pausing 2026 — Medium](https://shadhujan.medium.com/how-to-keep-supabase-free-tier-projects-active-d60fd4a17263) — cron heartbeat pattern, Supabase logs verification
- [Keep Supabase free-tier projects active](https://keepyoursupabasealive.com/) — auto-pause behavior, scheduled keepalive patterns
- [next-intl v4 Complete Guide — Build with Matija](https://www.buildwithmatija.com/blog/nextjs-internationalization-guide-next-intl-2025) — App Router + RTL implementation
- [Setup locale-based routing — next-intl](https://next-intl.dev/docs/routing/setup) — middleware matcher pattern

### Tertiary (LOW confidence — used for triangulation only)

- [Stop using NextJS middleware for refreshing the user token — Supabase issue #30241](https://github.com/supabase/supabase/issues/30241) — discussion around `getUser()` vs `getClaims()` in middleware; resolution recommends `getClaims()` since 2025
- [getClaims and token refresh — Answer Overflow](https://www.answeroverflow.com/m/1430675585935343777) — confirms `getClaims()` triggers token refresh when access token near expiry

## Metadata

**Confidence breakdown:**

- **Standard stack:** HIGH — every package version verified against official 2026 docs or release blogs
- **Architecture patterns:** HIGH for RLS lock-and-reveal (canonical Supabase pattern), HIGH for next-intl + Tailwind v4 (canonical 2026 pattern), MEDIUM for invite-code → `signInAnonymously()` → `profiles` flow (synthesized from Supabase anonymous-auth primitives; no single canonical recipe but every component is documented)
- **Pitfalls:** HIGH — CVE-2025-48757 post-mortems and Supabase 2025/2026 advisor lints back every claim
- **WC 2026 data:** HIGH on format (48 teams, 12 groups of 4, 104 matches, R32 with 8 best 3rd-placers — confirmed against FIFA and Wikipedia), MEDIUM on exact kickoff times (assume the planner will source from FIFA's published schedule; recommend a single JSON snapshot taken from FIFA's site immediately before migration 0003 is committed)
- **Hebrew team-name sourcing:** MEDIUM — no canonical JSON exists; manual curation + native-speaker review is the only path. DATA-04 inside Phase 1 is the right gate.

**Research date:** 2026-05-23
**Valid until:** 2026-06-23 (30 days for stable docs; Next.js 16 release window or Tailwind v4.4 release would warrant a refresh, but neither is imminent and Phase 1 must ship by June 1)

---

*Research for: Phase 1 (Foundation, Schema, Auth & RLS), Zarur-Cup / משחקי זערור*
*Researched: 2026-05-23 — ready for `/gsd:plan-phase 1`*
