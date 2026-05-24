# Zarur-Cup / משחקי זערור

Bilingual (Hebrew RTL + English LTR) FIFA World Cup 2026 family prediction pool.

**Core value:** predictions submitted before kickoff get scored automatically against a unified family leaderboard. If the leaderboard is broken, nothing else matters.

**Hard deadline:** June 11, 2026 (WC 2026 opening match).

## Quick Start (local dev)

```bash
npm install
cp .env.example .env.local   # fill in Supabase + INVITE_CODE + ADMIN_DISPLAY_NAME (see env table below)
npm run db:types             # regenerate src/types/supabase.ts from the linked Supabase project
npm run dev                  # http://localhost:3000 (Hebrew default at /he/)
```

> **Corporate networks:** if outbound TLS to `*.supabase.co` fails with `UNABLE_TO_GET_ISSUER_CERT_LOCALLY`, drop the corp CA bundle into `.dev/corp-ca.pem` and set `NODE_EXTRA_CA_CERTS="/absolute/path/to/.dev/corp-ca.pem"` in `.env.local`. This env var is **local-only** — Vercel's serverless runtime does not need it, so do NOT add `NODE_EXTRA_CA_CERTS` to Vercel.

## Useful Scripts

| Script | What it does |
|--------|--------------|
| `npm run dev` | Next.js dev server at http://localhost:3000 |
| `npm run build` | Production build |
| `npm run lint` | ESLint flat config |
| `npm run lint:rtl` | FND-03 — fail on physical-direction Tailwind utilities |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:types` | Regenerate `src/types/supabase.ts` from the linked Supabase project |
| `npm run db:push` | Push pending SQL migrations to Supabase |
| `npm run db:reset` | Reset the linked Supabase project (DESTRUCTIVE — local-dev only) |
| `npm run db:link` | Re-link the Supabase project ref |
| `npm run seed:build` | Compile `data/wc2026/*.csv` -> `supabase/migrations/0005_seed_wc2026.sql` |
| `npm run verify:rls` | Run anon-curl assertions against all RLS-protected tables (VIS-06) |
| `npm run verify:heartbeat` | Smoke-test the `/api/heartbeat` endpoint (FND-05) |

## Required Env Vars

All env vars below must be set in **`.env.local`** for local dev. The first five must also be set in **Vercel** for production. `NODE_EXTRA_CA_CERTS` is local-only — never set it on Vercel.

| Variable | Scope | Vercel? | Source |
|----------|-------|---------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | client + server | yes | Supabase dashboard -> Settings -> API |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | client + server | yes | Supabase dashboard (`sb_publishable_*`) |
| `SUPABASE_SECRET_KEY` | server only | yes (mark Sensitive) | Supabase dashboard (`sb_secret_*`) |
| `INVITE_CODE` | server only | yes (mark Sensitive) | rotated per-tournament; family receives via WhatsApp |
| `ADMIN_DISPLAY_NAME` | server only | yes | exact display-name match grants `is_admin` on join (D-04) |
| `SUPABASE_ACCESS_TOKEN` | CI/local only | no | Supabase account access token (for `db push` in non-TTY) |
| `SUPABASE_PROJECT_REF` | CI/local only | no | Supabase project settings -> general |
| `CRON_SECRET` | server only | **optional** | If set on Vercel, `/api/heartbeat` requires `Authorization: Bearer ${CRON_SECRET}` (Vercel Cron attaches this header automatically since 2025). Leaving it unset keeps the route public — that's the default per CONTEXT.md D-18. |
| `NODE_EXTRA_CA_CERTS` | local dev only | **NEVER** | path to corp CA `.pem` for JFrog network; gitignored under `.dev/`. Vercel does NOT need this; setting it there breaks TLS. |

See `.env.example` for the file layout.

## RTL / Bilingual Discipline (FND-03)

DO NOT use these Tailwind utilities anywhere in `src/`:

`pl-*`, `pr-*`, `ml-*`, `mr-*`, `text-left`, `text-right`, `border-l-*`, `border-r-*`, `left-*`, `right-*`, `flex-row-reverse`.

USE these logical-property equivalents instead:

| Avoid | Use |
|-------|-----|
| `pl-*` / `pr-*` | `ps-*` / `pe-*` |
| `ml-*` / `mr-*` | `ms-*` / `me-*` |
| `text-left` / `text-right` | `text-start` / `text-end` |
| `border-l-*` / `border-r-*` | `border-s-*` / `border-e-*` |
| `left-*` / `right-*` | `inset-s-*` / `inset-e-*` |
| `flex-row-reverse` | flip via `<html dir>` (next-intl) — never `flex-row-reverse` |

The pre-commit hook (`.husky/pre-commit`) and the GitHub Actions CI (`.github/workflows/lint.yml`) both run `npm run lint:rtl` — they will reject any commit / PR that violates this.

Plan 01-01 also added Tailwind v4.3 `@utility` shorthand aliases in `src/app/globals.css` (`bs-*`, `is-*`, `mi-*`, `pi-*`, `inset-i-*`, `min-bs-*`, `max-is-*`) for places where the canonical `pbs-*` / `mbs-*` longhands feel verbose. Both forms emit canonical CSS logical properties — both pass FND-03.

## Deploy Notes (Vercel)

1. Connect the GitHub repo to Vercel (https://vercel.com/new). Framework preset: Next.js (auto-detected).
2. Add all production env vars from the table above (set scope to Production + Preview).
3. Deploy. The cron job declared in `vercel.json` registers automatically on first prod deploy:
   - Path: `/api/heartbeat`
   - Schedule: `0 12 */3 * *` (every 3 days at 12:00 UTC)
   - Purpose: keep Supabase free tier from auto-pausing after 7 days of inactivity (FND-05).
4. **Vercel Hobby plan allows exactly 1 cron job.** Phase 1 consumes that slot. Any future cron need (leaderboard recompute, score notification fanout) must consolidate into `/api/heartbeat`, or the project upgrades to Vercel Pro.

To verify the heartbeat post-deploy:

```bash
bash scripts/verify-heartbeat.sh https://<your-vercel-url>
```

Then in the Vercel dashboard -> Cron Jobs -> click the heartbeat row -> "Run Now" -> open Supabase Dashboard -> Logs -> Postgres Logs and confirm a `select id` against `fixtures` shows up. **Vercel function logs alone don't prove the DB was hit** — the Supabase log line is the ground truth (RESEARCH Pitfall 6).

## Architecture pointers

- **Stack:** Next.js 15.5 (App Router, RSC + Server Actions), React 19, TypeScript, Tailwind v4.3, Supabase (Postgres + Auth), next-intl v4, Vercel.
- **Auth:** invite-code-gated `signInAnonymously()` + `profiles` table. Family-trust model — anyone with the invite code can rebind a display name (Plan 01-04, Pattern 15).
- **Bilingual routing:** `src/app/[locale]/...` with `localePrefix: 'always'`; Hebrew default at `/he/`. `<html lang dir>` is server-rendered, never `useEffect`.
- **RLS as the lock:** every predictions/answers table has lock-and-reveal RLS policies; the app code does NOT gate visibility. `npm run verify:rls` curls the anon endpoint to confirm `[]` everywhere.
- **Migrations are append-only.** Never edit a pushed migration — add a new sequential one. Generated by `scripts/build-seed-sql.ts` from `data/wc2026/*.csv` (CSVs are source of truth).
- **Service-role isolation:** `src/lib/supabase/service.ts` starts with `import 'server-only';` — leaking it into a client bundle fails the build.
- **Heartbeat:** `src/app/api/heartbeat/route.ts` is a public Vercel-Cron target that runs a real `select id from fixtures limit 1` via the service-role client. Optional `CRON_SECRET` Bearer guard activates when the env var is set.

## Contributing

1. `git checkout -b feature/<short-slug>`
2. Make changes.
3. `git commit -m "feat(<phase>-<plan>): <subject>"` — the pre-commit hook runs `lint:rtl` + `typecheck` automatically.
4. `git push -u origin feature/<short-slug>` -> open PR against `main`.
5. GitHub Actions runs `lint:rtl`, `lint`, `typecheck` on every PR.
6. Merge after green CI.

**Never bypass hooks** with `--no-verify`. The FND-03 gate exists because RTL discipline silently drifts the moment someone slips one `pl-2` through.

## Phase plans

Phase planning artifacts live under `.planning/phases/<NN-name>/`. See `.planning/ROADMAP.md` for the full phase structure and `.planning/STATE.md` for the current execution position.

Phase 1 (foundation, schema, auth, RLS) ships the deployed bilingual shell + invite-code auth + RLS-protected schema + WC 2026 seed + the heartbeat cron. Phase 2 ships the June 11 MVP (league predictions + scoring + leaderboard + admin). Phase 3 ships the bracket mode (target June 27).

## License

Private / family use. No license granted.
