# Phase 2 — Launch Checklist (QA-04 single-file ship gate)

All four checks below must be marked `[x]` before the family invite is distributed.

## QA-01 — Playwright smoke

- [ ] `npm run test:e2e` exits 0 locally against the live Supabase project `tjivukpxuhbrbshidbfv` with the smoke running against `next start` (NOT `next dev`).
- [ ] The smoke's **canonical RLS-rejection assertion** (`expect(writeResult.ok).toBe(false)` against SMOKE_POST_LOCK) is recorded as PASSED in the trace — NOT just the cosmetic 🔒 emoji visual check.
- [x] `.github/workflows/lint.yml` `e2e` job runs and passes on the merge commit (recorded as a CI badge or run ID). — **PASSED on commit `095a828` (1 test, 25.9s, 2026-05-25)**
- [ ] SmokeUser cleanup confirmed: zero orphaned rows in `profiles` / `predictions` / `score_events` / `auth.users` after the suite.
- [ ] Production-safety probe: `curl https://zarur-cup.vercel.app/api/test/save-prediction` returns HTTP 403 (T-02-08-07 verification).

Signed off by: ______________ on ______________

## QA-02 — Mobile QA HE+EN (zekez)

Real-phone (Android or iPhone) mobile QA pass — not just devtools emulation.

### Hebrew (`/he/*`)
- [ ] `/he/join` → invite code + display name → `/he/matches` works.
- [ ] `/he/matches`: stepper, debounced save, countdown banner, sticky date headers, locked variant, resulted variant — all functional. Numbers stay LTR inside Hebrew paragraphs.
- [ ] `/he/props`: all 7 prop_questions answerable; flag grid 6×8 visible + selectable; free-text input accepts Hebrew text and rejects HTML chars.
- [ ] `/he/leaderboard`: ranked list, single-expand row, Bracket placeholder shows `0 — נפתח 27 ביוני`.
- [ ] `/he/me`: total points visible; logout works.

### English (`/en/*`)
- [ ] Repeat all of the above on `/en/*` — works in LTR.

### I18N-06 deferred bidi stress test
- [ ] Scores embedded inside Hebrew paragraphs render correctly (e.g., the post-result reveal block, the `+4 exact` pts badge inside an HE row).
- [ ] No console errors / no obvious layout breakage on a 360px-wide viewport.

Signed off by: ______________ on ______________

## QA-03 — Hebrew native-speaker copy review (zekez)

Review every user-visible Hebrew string in `messages/he.json` AND `prop_questions.prompt_he` rows authored manually via `/admin/props`.

- [ ] All keys in `messages/he.json` (matches, props, leaderboard, prediction, countdown, match, pts, etc.) read naturally.
- [ ] Seeded `prop_questions.prompt_he` rows read naturally.
- [ ] Date headers, kickoff times, and countdown copy render correctly under Hebrew bidi.
- [ ] Bracket placeholder string `0 — נפתח 27 ביוני` reads naturally.
- [ ] Any corrections committed back to `messages/he.json` before sign-off (e.g., via a tiny `chore(02-08): qa-03 he copy fixes` commit).

Signed off by: ______________ on ______________

## QA-04 — Family invite distribution

- [ ] Production URL `https://zarur-cup.vercel.app` is live + reachable from a non-corp network.
- [ ] Vercel Cron `/api/heartbeat` is still firing (verify via Supabase Postgres logs — recent `SELECT FROM fixtures` entry within the last 3 days).
- [ ] WhatsApp message drafted:
  > Predict the WC: https://zarur-cup.vercel.app — invite code: `{INVITE_CODE}`
- [ ] Sent to family WhatsApp group on or before **June 11, 2026, 19:00 UTC** (opening kickoff).
- [ ] Send timestamp recorded here: ______________

Signed off by: ______________ on ______________

## Post-launch sanity (within 24h of June 11 kickoff)

- [ ] Heartbeat cron continues to fire every 3 days (verify Supabase logs).
- [ ] At least one family member submitted a prediction (verify `SELECT count(*) FROM predictions WHERE submitted_at > '2026-06-11T00:00:00Z'`).
- [ ] Integrity widget on `/admin/*` shows `Database Sync: OK ✓` with zero lock-breaches.
