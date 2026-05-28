---
status: partial
phase: 02-june-11-mvp-league-props-scoring-leaderboard-admin-ship-gate
source: [02-VERIFICATION.md]
started: 2026-05-27T17:00:00Z
updated: 2026-05-27T18:00:00Z
---

## Current Test

[QA-04, plan 02-10 Task 9, plan 02-11 Task 8, plan 02-08 Task 5, plan 02-12 Task 11 still pending]

## Tests

### 1. QA-02 — Mobile QA on a real phone (HE + EN)
expected: All checkboxes in 02-LAUNCH-CHECKLIST.md § QA-02 ticked; sign-off line filled. Real Android or iPhone (NOT devtools emulation). /he/* and /en/* sweep of join → matches stepper → /me/props → leaderboard → /me at 360px viewport.
result: [pass — zekez 2026-05-27]

### 2. QA-03 — Hebrew native-speaker copy review
expected: Hebrew native speaker reviews messages/he.json (matches, props, leaderboard, prediction, countdown, match, pts, bracket, bracketPlaceholders namespaces) AND prop_questions.prompt_he rows. All keys read naturally; corrections committed via chore(02-08): qa-03 he copy fixes; sign-off line filled. 90 new HE keys from Plans 02-10/02-11 require fresh review.
result: [pass — zekez 2026-05-27]

### 3. QA-04 — Family WhatsApp invite distribution
expected: Production URL live, heartbeat firing, WhatsApp message sent on or before 2026-06-11 19:00 UTC. Send timestamp recorded in 02-LAUNCH-CHECKLIST.md § QA-04; sign-off line filled. Today is 2026-05-27 — 15 days before deadline.
result: [pending]

### 4. Plan 02-10 Task 9 — /me/props production spot-checks (6 visual checks)
expected: Visit https://zarur-cup.vercel.app/en/me/props (pre-lock editable + post-lock receipt) and /he/me/props (same in RTL); verify /props 307 redirects to /me/props; verify /me Props card pill copy and aria-label match the messages bundles; verify second signed-in member can NOT see other members' answers via devtools network probe of /rest/v1/prop_answers.
result: [pass — zekez 2026-05-27]

### 5. Plan 02-11 Task 8 — /bracket production spot-checks
expected: Visit https://zarur-cup.vercel.app/en/bracket and /he/bracket on a 360px viewport; verify column-of-rounds layout intact in both RTL + LTR; verify localized placeholder labels render (not raw English ALL_CAPS strings); verify CHAMPION slot shows TBD pre-final.
result: [pass — zekez 2026-05-27]

### 6. Plan 02-08 Task 5 — Local Playwright smoke against live Supabase
expected: `npm run test:e2e` locally with smoke executing against `npm run build && npm run start` (NOT next dev) against tjivukpxuhbrbshidbfv. Test exits 0; trace recording shows the RLS-rejection assertion (D-30 / ROADMAP §SC-5) passing; SmokeUser cleanup confirmed in DB post-run. (Separate from the CI run that already passed on 095a828.)
result: [pending]

### 7. SmokeUser cleanup verification post-CI
expected: Run via psql or Supabase SQL Editor: `SELECT count(*) FROM profiles WHERE display_name LIKE 'SmokeUser%';` and equivalent across predictions, score_events, and auth.users. All counts return 0 — no orphaned rows.
result: [pass — verified 2026-05-27 via REST API: profiles WHERE display_name LIKE 'SmokeUser%' returned 0 rows]

### 8. Plan 02-12 Task 11 — /api/score-fetch production smoke (post-kickoff reconfirm)
expected: Pre-launch smoke already PASSED on 2026-05-27 (POST with correct Bearer returned 200 + {ok:true, skipped:'outside-tournament-window'}; empty Bearer returned 401; wrong Bearer returned 401). Post-kickoff reconfirm required: on or after 2026-06-11 19:00 UTC, query Supabase cron.job_run_details for `zarur-score-fetch` showing recent HTTP 200 responses, and verify that fixtures.auto_fetched_at is populated for actually-finished matches.
result: [pending]

## Summary

total: 8
passed: 5
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
