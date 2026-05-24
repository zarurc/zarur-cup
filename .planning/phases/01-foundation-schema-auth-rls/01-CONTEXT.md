# Phase 1: Foundation, Schema, Auth & RLS - Context

**Gathered:** 2026-05-23
**Status:** Ready for planning

<domain>
## Phase Boundary

A deployed bilingual Next.js 15.5 shell at `/he/...` and `/en/...` with locale routing, server-side `<html dir>`, browser-detect default to Hebrew, and a logical-property-only Tailwind v4 build — backed by a Supabase project with the full schema (`tournament`, `profiles`, `teams`, `fixtures`, `bracket_slots`, `bracket_picks`, `predictions`, `prop_questions`, `prop_answers`), RLS policies that already lock-and-reveal even though no predictions exist yet, and an invite-code → `signInAnonymously()` → `profiles`-row join flow. The schema is fully seeded (48 teams, 104 fixtures with symbolic `WINNER_GROUP_*` / `R32_M*_W` placeholders for knockouts, the R32→Champion bracket slot graph). A Vercel Cron pings `/api/heartbeat` every 3 days so the Supabase free tier cannot auto-pause before kickoff.

**What is NOT in scope:**
- Per-match prediction entry UI / steppers / "saved" feedback (Phase 2: LGE-*)
- Admin result-entry UI, prop authoring UI (Phase 2: ADM-*)
- Scoring engine, `v_leaderboard` view, score_events table (Phase 2: SCR-*)
- Bracket pick UI (Phase 3: BRK-*)
- Playwright smoke tests (Phase 2: QA-01)
- Hebrew native-speaker copy review (Phase 2: QA-03 — but the team-name pass DATA-04 happens in Phase 1)

</domain>

<decisions>
## Implementation Decisions

### Invite-Code Auth (AUTH-01, AUTH-02, AUTH-07)

- **D-01:** Single static invite code stored in `INVITE_CODE` env var on Vercel (server-only, no `NEXT_PUBLIC_` prefix). Server Action on `/[locale]/join` compares the submitted value against `process.env.INVITE_CODE` exactly, then calls `supabase.auth.signInAnonymously()` and inserts a `profiles` row tied to `auth.uid()`.
  - Rotation = change the env var on Vercel (instant).
  - One shared code matches PROJECT.md's "shared family invite code."
- **D-02:** AUTH-07 (rate-limiting) is satisfied by **Supabase's built-in 30-anon-signins/hr/IP rate limit only**. No Cloudflare Turnstile, no per-IP attempt table in v1. Family-trust threat model + 15-person scale doesn't warrant the extra dep. **This is a deliberate re-interpretation of AUTH-07's wording** — capture it in the requirement's note column so it doesn't get flagged in audit.
- **D-03:** Wrong-code UX: inline error via `useActionState`; generic message (don't confirm whether the code format is even close — minor defense against guessing). Trim the submitted code; case-sensitive match.

### Admin Bootstrap (AUTH-06, ADM-*)

- **D-04:** Admin identity is established via env-var display-name match. `ADMIN_DISPLAY_NAME` is a server-only env var on Vercel. The join Server Action sets `is_admin = true` when the chosen display name **exactly equals** `process.env.ADMIN_DISPLAY_NAME` (after the same normalization as the uniqueness check — see D-08). All other joiners get `is_admin = false`.
  - Mitigation against name-squat: user (zekez) joins first.
  - Idempotent across DB resets: re-seed by joining again with the same display name.
- **D-05:** Admin routes live at unlocalized **`/admin/...`** (no `[locale]` segment). **This is a deliberate deviation from AUTH-06's literal "`/[locale]/admin/...`" wording.** The spirit of AUTH-06 (server-side gating, admin-only) is preserved. English-only admin pages avoid translation work for screens only one person sees. Capture the deviation explicitly in the AUTH-06 traceability note.
- **D-06:** Admin gate enforced server-side at the layout level for `/admin/*` — Next middleware redirect + a server-side `getClaims()` + `profiles.is_admin` check in `app/admin/layout.tsx`. UI hiding is not the gate; server-side check is.

### Display-Name Policy (AUTH-03)

- **D-07:** Length 2–24 characters. Allowed: Hebrew letters, Latin letters, digits, ASCII space (between non-space chars only — no leading/trailing whitespace after trim). Disallowed for v1: `< > / \ & ' " ; \``, control chars, emoji. Server-side rejection on the join Server Action via a shared Zod schema.
- **D-08:** Uniqueness is **case-insensitive + whitespace-trimmed + Unicode NFC-normalized**. Implemented as either a generated column on `profiles.display_name_normalized = lower(trim(normalize(display_name, NFC)))` with a unique index, or a unique functional index on `lower(trim(normalize(display_name, NFC)))`. The form display value preserves the original casing/composition.
- **D-09:** On conflict, return an inline error via `useActionState`: localized "This name is already taken — try another." No auto-suggestions, no auto-discriminator. User picks again.
- **D-10:** XSS defense in depth: validation layer rejects the dangerous characters; render layer relies on React's default JSX escaping (never `dangerouslySetInnerHTML` for display names).

### Late-Entrant Policy

- **D-11:** **Open join, zero past points.** Family can join any time during the tournament. `profiles.joined_at timestamptz default now()`. Already-locked matches yield zero points because RLS rejects writes to `predictions` for fixtures past kickoff (same lock everyone hits). Props become read-only at first kickoff for everyone (no special handling for late joiners — they just see locked questions). Bracket picks become read-only at the bracket reveal moment in Phase 3.
- **D-12:** No "cutoff" kill-switch in the join Server Action. No admin approval flow.

### Bilingual Shell (FND-02, I18N-01..07, FND-06)

- **D-13:** Visual personality: **Modern sports clean**. High-contrast minimal — single dark primary (dark green or navy, planner to pick exact hex), white/cream surface, single accent (yellow or red, planner to pick), generous whitespace, geometric sans typography. Avoid FIFA-clone saturation; avoid hand-drawn warmth. Tailwind tokens + one accent.
- **D-14:** Logo / wordmark: **text-only wordmark**. Hebrew wordmark "משחקי זערור" primary on `/he/`; Latin wordmark "Zarur Cup" primary on `/en/`. The other locale's wordmark shown smaller below or omitted. No icon, no illustration. Renders via the same custom-feeling typeface as the rest of the headers.
- **D-15:** Typography: **Heebo (Hebrew) + Inter (Latin)**, both Google Fonts, self-hosted via `next/font/google`. Two weights each (400/500 + 700). Tailwind `font-sans` token switches by locale via `lang`-aware utility or a `dir`-aware CSS variable. Total font payload ≤ ~80KB.
- **D-16:** Mobile navigation: **bottom tab bar**, 3–4 tabs sized for thumb reach. Phase 1 tabs: `Matches` · `Bracket` (placeholder — links to a "coming soon" page until Phase 3) · `Leaderboard` (placeholder until Phase 2) · `Me`. The bar uses flex-row + the `<html dir>` value, so tab order flips automatically in Hebrew.
- **D-17:** Locale toggle: **header pill** on the inline-end side of a sticky top header (HE/EN or a globe icon). On click, swaps locale on the current URL (`/he/foo` ↔ `/en/foo`) and persists to a cookie (and `profiles.locale` if signed in). Page stays on the same content in the new language. Always visible.

### Cron Heartbeat (FND-05)

- **D-18:** `/api/heartbeat` is a public Next route handler scheduled by Vercel Cron every 3 days (`0 0 */3 * *` UTC or similar). Returns `{ ok: true, pinged_at: <ISO> }` after executing `SELECT id FROM fixtures LIMIT 1` against Supabase using the **service-role / secret key** (this must be a real DB query, not just a `select 1` against `auth`). Heartbeat is unauthenticated by default — the route is intentionally side-effect-free and idempotent (read-only single-row SELECT). **W2 opt-in:** Vercel Cron supports `Authorization: Bearer <secret>` since 2025; setting `CRON_SECRET` in Vercel env vars activates an auth guard inside the route without code changes. Phase 1 ships with the guard present-but-dormant (no secret set) per the original D-18 public-acceptance posture. Verify pings hit the DB via Supabase project logs, not just Vercel function logs.

### Schema & RLS (FND-04, DATA-*, VIS-06)

- **D-19:** Tables to create in Phase 1: `tournament`, `profiles` (with `joined_at`, `locale`, `is_admin`, `display_name`, `display_name_normalized`), `teams`, `fixtures` (with `home_placeholder`, `away_placeholder` symbolic text refs), `bracket_slots`, `bracket_picks`, `predictions`, `prop_questions`, `prop_answers`. All timestamps `timestamptz`, never `timestamp`.
- **D-20:** RLS enabled at table creation. Lock-and-reveal policies reference `fixtures.kickoff_at <= now()` in both `USING` (reads) and `WITH CHECK` (writes). Use `(select auth.uid())` pattern (never bare `auth.uid()`) for performance per CVE-2025-48757 guidance. Even though `predictions` will have zero rows in Phase 1, the policy must be live so a curl from a logged-out terminal returns zero rows from the moment the schema is deployed.
- **D-21:** All migrations live in `supabase/migrations/` with sequential names (`0001_init.sql`, `0002_rls.sql`, `0003_seed.sql` — exact names planner's call). `npm run db:types` runs `npx supabase gen types typescript --linked > types/supabase.ts` after every schema change.
- **D-22:** WC 2026 seed: 48 teams with `name_en`, `name_he`, ISO country code, group letter. 104 fixtures with UTC kickoff times, stage labels, group codes, and symbolic placeholders for knockouts (`WINNER_GROUP_A`, `R32_M1_W`, etc.). Bracket slot graph (R32 → R16 → QF → SF → F + Champion) fully populated. DATA-04 Hebrew team-name review happens **inside Phase 1**, not Phase 2 — it gates the schema/seed sign-off. **Reviewer: `zekez` (the project owner)** — confirmed by user 2026-05-23. No "TBD."

### Claude's Discretion

- Exact hex values for primary + accent in "Modern sports clean" palette — planner / UI-phase agent picks. Suggested starting points: primary `#0f3d2e` (dark forest) or `#0a2540` (deep navy); accent `#f59e0b` (warm yellow) or `#dc2626` (red).
- Tab labels' exact localized strings — UI-phase agent picks the Hebrew/English wording from `messages/{en,he}.json`.
- Whether `/api/heartbeat` returns a small JSON body or `204 No Content`.
- Whether the bracket slot graph is one denormalized table or two (slots + adjacency edges) — schema planner's call as long as the slot identity survives placeholder resolution.
- Exact migration file naming convention within `supabase/migrations/`.
- Whether `profiles.display_name_normalized` is a generated column or a functional unique index — both meet D-08; planner picks based on Postgres ergonomics.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project-level decisions

- `.planning/PROJECT.md` — Vision, core value, constraints, Key Decisions table (most marked Pending — Phase 1 confirms several)
- `.planning/REQUIREMENTS.md` §"Foundation & Shell" / §"Internationalization & Localization" / §"Authentication & Identity" / §"Tournament Data" / §"Visibility" — the 26 requirements mapped to Phase 1 (FND-01..06, I18N-01..07, AUTH-01..07, DATA-01..05, VIS-06)
- `.planning/ROADMAP.md` §"Phase 1" — phase goal + success criteria + dependency notes
- `.planning/STATE.md` §"Open Questions" — late-entrant policy (now D-11), Hebrew native-speaker reviewer scheduling (now in Phase 1 per D-22)
- `CLAUDE.md` §"Technology Stack" — full stack rationale, Supabase auth approach, RLS guidance, free-tier gotchas, env-var hygiene table, "What NOT to Use" list

### Research

- `.planning/research/SUMMARY.md` §"Phase 1: Foundation & Bilingual Shell" / §"Phase 2: Schema, Auth & RLS" — research collapsed Phase 1+2 into our single Phase 1; both apply
- `.planning/research/STACK.md` — version pins, install commands, version compatibility matrix
- `.planning/research/ARCHITECTURE.md` — full schema sketch, RLS policy patterns, `lib/db`/`lib/auth` module boundaries
- `.planning/research/PITFALLS.md` §1 (RLS read-leak / CVE-2025-48757), §2 (client-side lock check), §4 (Tailwind physical utilities), §5 (Supabase auto-pause), §6 (timestamptz), §7 (late-entrant)
- `.planning/research/FEATURES.md` §"Must have" — Phase 1 ships the foundation only; feature surface unlocks in Phase 2

### Standards/specs the planner should cite

- [Supabase Anonymous Sign-Ins](https://supabase.com/docs/guides/auth/auth-anonymous) — `signInAnonymously()` and `is_anonymous` JWT claim
- [Supabase Server-Side Auth (Next.js)](https://supabase.com/docs/guides/auth/server-side/nextjs) — `@supabase/ssr` + `getClaims()` pattern
- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security) — `(select auth.uid())` performance pattern
- [Next.js 15.5 release blog](https://nextjs.org/blog/next-15-5) — typed routes, server actions, App Router stability
- [Tailwind CSS v4.3 release](https://tailwindcss.com/blog/tailwindcss-v4-3) — logical-property utilities; v4.2+ has full coverage so `tailwindcss-rtl` is NOT installed
- [next-intl App Router docs](https://next-intl.dev/docs/getting-started/app-router) — `[locale]` segment, browser detection, `<html dir>` strategy

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

None — greenfield project. Repo currently contains `.planning/` and `CLAUDE.md` only. No `package.json`, no `src/`, no migrations. Phase 1 bootstraps everything via `create-next-app@latest`.

### Established Patterns

None yet. Phase 1 establishes the patterns the rest of the project follows:
- App Router with `src/app/[locale]/.../page.tsx`
- Server Actions in `src/app/actions/*.ts` or co-located with the form (planner's call)
- `lib/db/*` and `lib/auth/*` modules as the sole consumers of `@supabase/ssr` server client
- Shared Zod schemas in `lib/schemas/*` (used by both client form + server action + DB insert)
- Migrations sequential in `supabase/migrations/`
- Messages in `messages/he.json` and `messages/en.json`

### Integration Points

- Future Phase 2 (LGE/PRP/ADM/SCR/LB/VIS): consumes `predictions`, `prop_answers` tables and the RLS policies created in Phase 1
- Future Phase 3 (BRK): consumes `bracket_slots`, `bracket_picks`, and the RLS policies created in Phase 1
- Both Phase 2 and Phase 3 read the locale routing, `<html dir>` setup, and bilingual shell from Phase 1

</code_context>

<specifics>
## Specific Ideas

- **Wordmark primary text** — Hebrew "משחקי זערור" on `/he/`, Latin "Zarur Cup" on `/en/`. Both come from PROJECT.md title.
- **Bottom-tab labels for Phase 1** — Matches / Bracket / Leaderboard / Me, where Bracket and Leaderboard are placeholder pages with copy like "Available once predictions start" — not 404s. They're discoverable from day 1 so the nav doesn't reshuffle when later phases land.
- **Default locale** — Hebrew. Browser detection picks `he` for any `Accept-Language` containing Hebrew; falls back to Hebrew for everything else (NOT English). This is per PROJECT.md "Hebrew is the family spirit language."
- **No fallback English** — locale is locked to `he` or `en`; unknown locale → redirect to `/he/`.
- **Cron schedule** — every 3 days (~10 pings in the 19-day pre-tournament window, then continues through the tournament).

</specifics>

<deferred>
## Deferred Ideas

- **Cloudflare Turnstile on join form** — explicitly skipped for v1 (D-02). If abuse becomes a problem post-launch, add Turnstile + reinstate AUTH-07's literal wording. Probability of needing this in a 15-person family pool: ~0.
- **Multi-language admin pages** — `/admin/...` is English-only for v1 (D-05). If a second admin ever joins who needs Hebrew, add `[locale]` segment back. v2 concern.
- **Logo/iconography upgrade** — Phase 1 ships text wordmark only (D-14). A small soccer-ball / trophy / family-crest mark can land in Phase 6 polish if time permits. Captured in PROJECT.md "Should have."
- **Admin "merge users" tool** for reconciling duplicate device-locked sessions (ADM-05) — Phase 2 admin dashboard scope. Schema-side, the `profiles` table already supports this in Phase 1 (a UUID per row), but no UI/Server Action in Phase 1.
- **Profile-level locale persistence (`profiles.locale`)** — the column exists in Phase 1's schema (D-19) so D-17's "persist to profiles.locale if signed in" works the moment a user signs in. But Phase 1 has no settings page UI — locale changes via the header pill update both cookie + `profiles.locale`.
- **Realtime leaderboard subscription, prediction history view, head-to-head, dark mode, badges** — all v2 per `.planning/REQUIREMENTS.md` §"v2 Requirements"; not in scope.

</deferred>

---

*Phase: 1-Foundation-Schema-Auth-RLS*
*Context gathered: 2026-05-23*
