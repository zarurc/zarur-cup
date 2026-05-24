---
phase: 01-foundation-schema-auth-rls
plan: 03
subsystem: data
tags: [supabase, postgres, seed, csv, wc2026, hebrew, i18n, bracket, fixtures, migrations]

# Dependency graph
requires:
  - "01-01: Next.js + Supabase server client, .env.local with SUPABASE_ACCESS_TOKEN + project ref"
  - "01-02: 9 Phase-1 tables on live project tjivukpxuhbrbshidbfv with RLS enabled + table-level GRANTs (service_role full DML; authenticated full DML except profiles column-scoped; anon SELECT on every table)"
provides:
  - "1 tournament row on live Supabase project tjivukpxuhbrbshidbfv (code='wc2026', starts_at=2026-06-11T19:00:00Z, ends_at=2026-07-19T23:59:59Z)"
  - "48 teams on live DB with bilingual names (name_en + name_he), ISO-3 codes, group letters A..L (12 groups of 4) -- reflects FIFA Final Draw of December 2025"
  - "104 fixtures on live DB with UTC timestamptz kickoffs: 72 group-stage (with team FKs) + 32 knockout (with symbolic placeholders WINNER_GROUP_*, RUNNER_UP_GROUP_*, THIRD_PLACE_*, R32_M*_W, R16_M*_W, QF_M*_W, SF_M*_W/L)"
  - "32 bracket_slots on live DB wired R32 -> R16 -> QF -> SF -> F -> CHAMPION via parent_slot_id; exactly 1 row (CHAMPION) has null parent (verified)"
  - "7 prop_questions on live DB with bilingual prompts (prompt_en + prompt_he), structured answer_type (single_team / single_player / text), per-question point values"
  - "data/wc2026/*.csv -- human-editable source-of-truth files (zekez edits these, not SQL); pre-push grep gate enforces zero duplicate team codes"
  - "scripts/build-seed-sql.ts -- generates idempotent ON CONFLICT seed migrations from CSVs; extended with --target and --reseed flags to support FK-safe reseeds; integrity DO-block counts are emitted from CSV row counts (NOT hard-coded)"
  - "supabase/migrations/0005_seed_wc2026.sql -- historical pre-draw seed (kept in repo + migration table for the audit trail); was the initial canonical seed but used projected groups before the Dec 2025 Final Draw"
  - "supabase/migrations/0006_reseed_wc2026.sql -- corrective reseed using the real Dec 2025 draw; DELETEs old rows in FK-safe order (predictions -> fixtures -> bracket_slots -> teams) scoped to tournament_id, then re-INSERTs from the rebuilt CSVs; same idempotent ON CONFLICT shape"
  - "DATA-04 sign-off: zekez approved all 48 name_he values + all 12 group assignments on 2026-05-23"
affects:
  - "01-04 (auth/UI): join page reads tournament.starts_at to compute pre-tournament-vs-locked banner; profile insert references tournament_id via the WC2026 row"
  - "Phase 2 (League): predictions.fixture_id FKs to the 104 fixtures rows; LGE-04 RLS lock reads fixtures.kickoff_at directly (now UTC-correct)"
  - "Phase 2 (Props): prop_answers RLS lock reads tournament.starts_at (now corrected to 19:00:00Z, the real Estadio Azteca 1pm-local kickoff in UTC); the 7 prop_questions seeded here are the question set users answer"
  - "Phase 2 (Admin): admin result entry writes to fixtures (98 group-stage rows + 32 KO rows -- 104 total); placeholder resolution (ADM-03) updates WINNER_GROUP_* style placeholders to real team codes"
  - "Phase 3 (Bracket): bracket_picks.slot_id FKs to bracket_slots; the 32 slots are wired with correct FIFA R32->R16 non-sequential pairing (R16_M1 = R32_M2_W vs R32_M5_W, etc.) so picks survive placeholder resolution naturally"
  - "Future tournaments: the build-seed-sql.ts --reseed pattern (delete-then-insert scoped to tournament_id, with tournament row UPSERTed first) is the canonical reseed shape for any downstream tournament"

# Tech tracking
tech-stack:
  added:
    - "tsx (devDep, already installed via Plan 01-01) -- runs scripts/build-seed-sql.ts"
  patterns:
    - "CSVs in data/<tournament>/*.csv are the source of truth; SQL migrations are GENERATED, not hand-edited. Edit the CSV, re-run `npm run seed:build`, push."
    - "Seed migration is idempotent via ON CONFLICT DO UPDATE on every table. Re-running the same migration converges to the CSV state."
    - "Integrity-check DO-block at end of every seed migration: declares constant int := <literal>, queries actual count, RAISE EXCEPTION on mismatch. Build script substitutes the literal from the CSV row count it just emitted (NOT hard-coded 48). Postgres wraps the migration in a transaction so an integrity failure rolls back the entire seed."
    - "Reseed pattern (for corrections after a push): write a new sequential migration that DELETEs in FK-safe order (children before parents) scoped to tournament_id, then runs the same ON CONFLICT INSERT block as the original seed. UPSERTs the tournament row first so the tournament_id reference resolves. Never edit a pushed migration."
    - "Bracket slot parent_slot_id wiring uses a two-pass approach: pass 1 INSERTs slots (parent_slot_id null), pass 2 UPDATEs parent_slot_id via a self-join keyed on slot_code. CTE-style inserts cannot self-reference."
    - "FIFA WC 2026 R32->R16 pairings are non-sequential (R16_M1 = R32_M2_W vs R32_M5_W, etc.). Naive sequential pairing (R32_M1 vs R32_M2) is wrong. Cross-reference FIFA's published bracket diagram, never assume."
    - "tournament.starts_at is the single source of truth for prop_answers lock and pre-tournament UI gating. Must be the actual ISO 8601 UTC kickoff of match 1 (2026-06-11 Estadio Azteca, 1pm local Mexico City = UTC-6 = 19:00:00Z), NOT a round 20:00:00Z approximation."

key-files:
  created:
    - "data/wc2026/teams.csv -- 48 teams, FIFA Dec 2025 Final Draw, columns: code,name_en,name_he,group_code (zero duplicate codes; awk gate enforced pre-push)"
    - "data/wc2026/fixtures.csv -- 104 fixtures (72 group + 32 KO), columns: external_match_no,stage,group_code,home_code,away_code,home_placeholder,away_placeholder,kickoff_at_utc,venue_code; every kickoff_at_utc has explicit Z suffix"
    - "data/wc2026/bracket_slots.csv -- 32 slots (16 R32 + 8 R16 + 4 QF + 2 SF + 1 F + 1 CHAMPION), columns: slot_code,stage,parent_slot_code,fixture_external_match_no; non-sequential FIFA R32->R16 pairings corrected after initial CSV had naive sequential wiring"
    - "data/wc2026/prop_questions.csv -- 7 tournament-level props with bilingual prompts, columns: code,prompt_en,prompt_he,answer_type,points"
    - "scripts/build-seed-sql.ts -- compiles CSVs into deterministic SQL migration (~25kb script); duplicate-code gate at SQL-gen time (defense in depth on top of the CSV awk gate); --target <path> and --reseed flags added during the corrective reseed work"
    - "supabase/migrations/0005_seed_wc2026.sql -- initial seed migration (pre-draw projection, kept in repo + Supabase migration table as historical record); 42kb generated SQL with ON CONFLICT, integrity DO-block"
    - "supabase/migrations/0006_reseed_wc2026.sql -- corrective reseed migration with FK-safe DELETE + re-INSERT; 45kb generated SQL using --reseed flag of build script"
    - ".planning/phases/01-foundation-schema-auth-rls/01-03-SUMMARY.md -- this file"
  modified:
    - "package.json -- `seed:build` npm script wired to tsx scripts/build-seed-sql.ts (set up during Task 2)"

key-decisions:
  - "Migration filename shifted from planned 0003_seed_wc2026.sql to 0005_seed_wc2026.sql: Plan 01-02 shipped 4 migrations (0001 init, 0002 RLS, 0003 grants, 0004 anon_select) instead of the planned 2 -- the seed migration moved up two slots accordingly. Sequential append-only convention preserved."
  - "Full reseed required: original CSV authoring (commit 7f7c978) used the research file's pre-draw projected groups (research was authored before the December 2025 Final Draw). User caught the projection error post-push. Rebuilt teams.csv (d8c05ed) + fixtures.csv + bracket_slots.csv parent wiring (5aeea2d), then shipped corrective migration 0006_reseed_wc2026.sql (3a2cd73). Migration history is append-only; 0005 stays in git and the Supabase migration table as a documented historical pre-draw seed."
  - "Bracket parent_slot_id wiring corrected: original bracket_slots.csv had naive sequential R32->R16 pairings (R16_M1 = R32_M1_W vs R32_M2_W). Real FIFA bracket pairs non-sequentially (R16_M1 = R32_M2_W vs R32_M5_W). Slot codes unchanged; only parent_slot_code values changed. Now consistent with FIFA's published bracket diagram."
  - "tournament.starts_at corrected to 2026-06-11T19:00:00Z (was 20:00:00Z): opener is 1pm local at Estadio Azteca in Mexico City (UTC-6) = 19:00 UTC. The RLS prop_answers lock and downstream pre-tournament UI banners key on this column -- a 1-hour drift would have shifted when prop_answers reveal."
  - "Build script extended with --target <path> and --reseed flags during the rebuild: the canonical seed:build path (npm run seed:build) still emits the ON CONFLICT INSERT block; --reseed prepends an FK-safe DELETE block scoped to the tournament_id, supporting the corrective migration without disturbing the standard re-seed-via-ON-CONFLICT idempotent path."
  - "Canonical reseed shape established: UPSERT the tournament row on code='wc2026' first; DELETE child rows in FK-safe order (predictions before fixtures before bracket_slots before teams) scoped to that tournament_id; re-INSERT from CSVs with the same ON CONFLICT shape. This pattern will be reused for any future tournament correction or new tournament onboarding."
  - "DATA-04 sign-off: per CONTEXT.md D-22 the Hebrew team-name reviewer was zekez (the project owner). All 48 name_he values + 12 group assignments approved 2026-05-23 (in chat). No corrections requested."

patterns-established:
  - "Pattern 9: Data CSVs (data/<tournament>/*.csv) are the source of truth; SQL is generated. Editing committed SQL migrations directly is forbidden -- edit the CSV and rebuild + add a new migration."
  - "Pattern 10: Seed integrity check uses CSV-derived counts (build script substitutes literals at code-gen time), not hard-coded numbers. Allows partial-qualifier or partial-fixture seeds to validate cleanly during pre-tournament authoring."
  - "Pattern 11: Reseed pattern for post-push corrections: UPSERT parent (tournament) -> DELETE children FK-safe scoped to parent FK -> ON CONFLICT INSERT from current CSVs. Same build-seed-sql.ts with --reseed flag. Never edit a pushed migration."
  - "Pattern 12: Duplicate-code defense in depth: (a) awk pipeline on the CSV (Task 1 pre-push gate), (b) build-seed-sql.ts throws at SQL-gen time, (c) schema unique(tournament_id, code) is the final safety net. The schema constraint should never be the gate that catches the bug."
  - "Pattern 13: tournament.starts_at is the canonical lock anchor for prop_answers and pre-tournament UI; must encode the real first-match ISO 8601 UTC kickoff, never a rounded approximation."

requirements-completed:
  - DATA-01
  - DATA-02
  - DATA-03
  - DATA-04
  - DATA-05
  - I18N-05

# Metrics
duration: 62min
completed: 2026-05-23
---

# Phase 01 Plan 03: WC 2026 Seed Data Summary

**WC 2026 seed (48 teams with Hebrew names, 104 fixtures, 32 bracket slots with non-sequential FIFA R32->R16 wiring, 7 props) live on Supabase project `tjivukpxuhbrbshidbfv`; rebuilt after the pre-draw projection error was caught by zekez and corrected with the real December 2025 Final Draw via a follow-up FK-safe reseed migration.**

## Performance

- **Duration:** ~62 min (Plan 01-03 first commit 2026-05-23T21:28:44Z -> SUMMARY 2026-05-23T22:31Z)
- **Started:** 2026-05-23T21:28:44Z (first CSV commit 7f7c978)
- **Completed:** 2026-05-23T22:31:00Z
- **Tasks:** 4 (CSV authoring, build script + migration, push + verify counts, Hebrew review sign-off)
- **Files modified:** 6 source files (4 CSVs + 1 build script + 1 package.json line) + 2 migration files (0005 historical + 0006 corrective)

## Accomplishments
- 1 tournament + 48 teams + 104 fixtures + 32 bracket_slots + 7 prop_questions live on Supabase project `tjivukpxuhbrbshidbfv` -- all counts verified via SELECT count(*) on the live DB
- Bracket graph wired R32 -> R16 -> QF -> SF -> F -> CHAMPION with FIFA's actual non-sequential R32->R16 pairings (exactly 1 row -- CHAMPION -- has null parent_slot_id)
- DATA-04 Hebrew name review complete: zekez (project owner, per CONTEXT.md D-22) approved all 48 `name_he` values + 12 group assignments 2026-05-23
- Idempotent seed pattern established: CSVs are SOT, scripts/build-seed-sql.ts generates the SQL, ON CONFLICT DO UPDATE makes re-runs converge
- Corrective reseed pattern established: a follow-up migration with FK-safe DELETE + re-INSERT (via build script's `--reseed` flag) lets us correct post-push without ever editing a pushed migration -- reusable for future tournaments
- tournament.starts_at corrected to the real Estadio Azteca first-match kickoff (2026-06-11T19:00:00Z) -- the canonical lock anchor for prop_answers RLS and the pre-tournament UI banner

## Task Commits

1. **Task 1: Author WC 2026 source-of-truth CSVs (initial)** -- `7f7c978` (feat: teams.csv 48 teams, fixtures.csv 104 rows, bracket_slots.csv 32 slots, prop_questions.csv 7 props; **superseded** by Task 1.5 rebuild but kept in history)
2. **Task 2: Build idempotent seed migration (initial)** -- `e8a4741` (feat: scripts/build-seed-sql.ts + supabase/migrations/0005_seed_wc2026.sql; both kept in history; the migration also remains in the Supabase migration table as historical pre-draw record)
3. **Task 1.5a: Rebuild teams.csv with real Dec 2025 draw** -- `d8c05ed` (feat: replaces projected groups with FIFA Final Draw output)
4. **Task 1.5b: Rebuild fixtures.csv + correct bracket_slots.csv parent wiring** -- `5aeea2d` (feat: FIFA published schedule + non-sequential R32->R16 pairings)
5. **Task 2.5: Add corrective reseed migration + extend build script** -- `3a2cd73` (feat: scripts/build-seed-sql.ts gains --target and --reseed flags; supabase/migrations/0006_reseed_wc2026.sql DELETEs old rows FK-safe + re-INSERTs from rebuilt CSVs)
6. **Tasks 3 + 4: Push to live + Hebrew review sign-off** -- no separate commit (push to live DB executed via `supabase db push --linked`; zekez DATA-04 approval recorded inline in chat 2026-05-23; no source-file changes needed)

**Plan metadata:** `<this commit>` (docs: complete plan)

## Files Created/Modified

- `data/wc2026/teams.csv` -- 48 teams from FIFA Dec 2025 Final Draw with bilingual names (rebuilt in d8c05ed)
- `data/wc2026/fixtures.csv` -- 104 fixtures with UTC kickoffs and symbolic KO placeholders (rebuilt in 5aeea2d)
- `data/wc2026/bracket_slots.csv` -- 32 bracket slots wired R32 -> CHAMPION (parent wiring corrected in 5aeea2d)
- `data/wc2026/prop_questions.csv` -- 7 tournament-level props with bilingual prompts
- `scripts/build-seed-sql.ts` -- CSV -> SQL generator; ON CONFLICT idempotent; --target + --reseed flags
- `supabase/migrations/0005_seed_wc2026.sql` -- historical pre-draw seed (kept in repo + migration table)
- `supabase/migrations/0006_reseed_wc2026.sql` -- corrective reseed using the Dec 2025 draw
- `package.json` -- `seed:build` npm script wired to the generator

## Decisions Made

- **Filename slot 0005 (not 0003)**: Plan 01-02 shipped 4 migrations instead of 2 because of two deviations (0003_grants + 0004_anon_select); the seed migration moved up to 0005 to preserve append-only ordering.
- **Two-migration history (0005 + 0006)**: The first seed (0005) used pre-draw projected groups (research file pre-dated the Dec 2025 Final Draw). Rather than editing 0005, we wrote 0006 as an FK-safe corrective reseed -- the Supabase migration table now records both, with 0005 as the pre-draw historical record and 0006 as the source-of-truth state on live.
- **Bracket parent wiring corrected**: original bracket_slots.csv used naive sequential R32->R16 pairing. Real FIFA bracket is non-sequential. Corrected slot codes are unchanged; only `parent_slot_code` values changed.
- **tournament.starts_at = 19:00:00Z (not 20:00:00Z)**: the real opener is 1pm local at Estadio Azteca in Mexico City (UTC-6). The RLS prop_answers lock keys on this -- a 1-hour drift would shift when prop_answers reveal.
- **Build script extension**: added `--target <path>` and `--reseed` flags so the corrective migration can be generated by the same script without disturbing the canonical `npm run seed:build` ON CONFLICT path. New flag default is the existing path; --reseed adds FK-safe DELETE block prefix.
- **DATA-04 reviewer = zekez**: per CONTEXT.md D-22 the project owner is the Hebrew reviewer. Sign-off recorded 2026-05-23. No name corrections requested.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Migration filename shifted 0003 -> 0005**
- **Found during:** Task 2 (build seed migration)
- **Issue:** Plan referenced `supabase/migrations/0003_seed_wc2026.sql` but Plan 01-02 shipped 4 migrations (0001 init, 0002 RLS, 0003 grants, 0004 anon_select) instead of the planned 2 -- so 0003 was already taken by `0003_grants.sql`.
- **Fix:** Renamed target to `0005_seed_wc2026.sql`. Preserves the append-only migration convention established in Plan 01-02.
- **Files modified:** supabase/migrations/0005_seed_wc2026.sql (created), scripts/build-seed-sql.ts (output path), package.json (no change needed)
- **Verification:** `supabase db push --linked` applied 0005 successfully on the live project; integrity DO-block passed.
- **Committed in:** e8a4741

**2. [Rule 3 - Blocking] Full reseed required after pre-draw projection caught**
- **Found during:** Post-push (zekez review)
- **Issue:** The original CSV authoring used the research file's pre-draw projected groups (the research file was written before the December 2025 Final Draw, so its team-to-group assignments were speculative). The user caught the error after the seed was already pushed to live.
- **Fix:** Rebuilt all three primary CSVs (teams, fixtures, bracket_slots) using the real FIFA Final Draw output; extended `scripts/build-seed-sql.ts` with `--target` and `--reseed` flags to support an FK-safe DELETE + re-INSERT pattern; emitted `supabase/migrations/0006_reseed_wc2026.sql` which: (a) UPSERTs the tournament row, (b) DELETEs predictions -> fixtures -> bracket_slots -> teams scoped to the WC2026 tournament_id (FK-safe order), (c) re-INSERTs from the rebuilt CSVs with the same ON CONFLICT shape. Migration history is append-only -- 0005 stays in repo and the Supabase migration table as the documented historical pre-draw seed.
- **Files modified:** data/wc2026/teams.csv, data/wc2026/fixtures.csv, data/wc2026/bracket_slots.csv, scripts/build-seed-sql.ts, supabase/migrations/0006_reseed_wc2026.sql (created)
- **Verification:** `select count(*) from public.teams = 48`, `fixtures = 104`, `bracket_slots = 32`, `prop_questions = 7`, `tournament = 1` on the live DB after 0006 applied. `select count(*) from public.bracket_slots where parent_slot_id is null = 1` (CHAMPION).
- **Committed in:** d8c05ed (teams rebuild), 5aeea2d (fixtures + bracket parent wiring), 3a2cd73 (reseed migration + build-script flag extension)

**3. [Rule 1 - Bug] Bracket parent_slot_code wiring corrected (sequential -> FIFA non-sequential)**
- **Found during:** Task 1.5 (CSV rebuild)
- **Issue:** The original bracket_slots.csv used naive sequential R32->R16 pairings (R16_M1 = R32_M1_W vs R32_M2_W). The real FIFA bracket pairs non-sequentially (e.g. R16_M1 = R32_M2_W vs R32_M5_W). Slot codes themselves were correct; only the `parent_slot_code` mapping was wrong.
- **Fix:** Cross-referenced FIFA's published WC 2026 bracket diagram and rewrote all 16 R32 rows' `parent_slot_code` values. R16 -> QF -> SF -> F -> CHAMPION wiring was already correct; only the R32 -> R16 step needed correction.
- **Files modified:** data/wc2026/bracket_slots.csv
- **Verification:** After reseed, `select count(*) from public.bracket_slots where parent_slot_id is null = 1` (CHAMPION-only). Manual spot-check of three R16 rows confirms two distinct R32 parents each, matching FIFA's diagram.
- **Committed in:** 5aeea2d

**4. [Rule 2 - Missing Critical] tournament.starts_at corrected to 2026-06-11T19:00:00Z**
- **Found during:** Task 1.5 (CSV rebuild) -- noticed while cross-checking fixtures.csv kickoff times
- **Issue:** Original seed had `tournament.starts_at = '2026-06-11T20:00:00Z'`. The real opener is 1pm local at Estadio Azteca in Mexico City (UTC-6), which is 19:00 UTC -- a 1-hour drift. The `prop_answers` RLS lock-and-reveal policy keys on `tournament.starts_at`, so this drift would have caused prop_answers to reveal an hour late (or, worse, accept writes for an hour after the actual kickoff).
- **Fix:** Updated the literal in scripts/build-seed-sql.ts (tournament INSERT block) to `2026-06-11T19:00:00Z`. The 0006 reseed migration's ON CONFLICT UPDATE picks up the corrected value automatically.
- **Files modified:** scripts/build-seed-sql.ts, supabase/migrations/0006_reseed_wc2026.sql (generated)
- **Verification:** `select starts_at from public.tournament where code = 'wc2026'` on the live DB returns `2026-06-11 19:00:00+00`.
- **Committed in:** 3a2cd73 (build-script update + 0006 migration)

**5. [Note] Build script extended with --target and --reseed flags**
- **Found during:** Task 2.5 (reseed migration generation)
- **Issue:** Original build script always wrote to a hard-coded `supabase/migrations/0005_seed_wc2026.sql` path with the ON CONFLICT INSERT block only. The reseed migration needed (a) a different output path (0006) and (b) an FK-safe DELETE block prefix.
- **Fix:** Added `--target <path>` (overrides default output) and `--reseed` (prepends DELETE block scoped to the tournament_id) flags. `npm run seed:build` continues to work unchanged (defaults preserved). New flow: `tsx scripts/build-seed-sql.ts --target supabase/migrations/0006_reseed_wc2026.sql --reseed`.
- **Files modified:** scripts/build-seed-sql.ts
- **Verification:** `npm run seed:build` still produces a valid 0005 (re-running it after the corrections converges via ON CONFLICT). Reseed flow produced 0006 successfully.
- **Committed in:** 3a2cd73

**6. [Note] Canonical reseed shape (tournament-row UPSERT first, then children DELETE-then-INSERT)**
- **Found during:** Task 2.5 (reseed migration design)
- **Issue:** Plan didn't specify the shape of a corrective reseed migration -- only that the original seed must be idempotent via ON CONFLICT.
- **Fix:** Established the pattern: (a) UPSERT tournament row on code='wc2026' (so the tournament_id reference resolves); (b) DELETE in FK-safe child order scoped to that tournament_id (predictions -> fixtures -> bracket_slots -> teams; prop_answers omitted because none exist yet and won't until Phase 2); (c) ON CONFLICT INSERT from current CSVs (same INSERT block as a normal seed -- the ON CONFLICT is harmless after DELETE but keeps the migration runnable multiple times). Documented as Pattern 11 in this SUMMARY's `patterns-established`.
- **Files modified:** supabase/migrations/0006_reseed_wc2026.sql (uses the pattern); scripts/build-seed-sql.ts (--reseed flag emits the DELETE block)
- **Verification:** Pattern is reusable -- any future tournament correction or new tournament onboarding can use the same shape.
- **Committed in:** 3a2cd73

---

**Total deviations:** 6 (2 blocking, 1 bug, 1 missing critical, 2 notes / patterns)
**Impact on plan:** All six are corrections / improvements driven by post-push discoveries (filename slot, pre-draw projection, sequential bracket wiring, starts_at drift) or pattern formalization (reseed shape, build-script flags). The plan's contract was upheld: 48 teams, 104 fixtures, 32 slots, 7 props, 1 tournament row, all bilingual, all RLS-friendly, all idempotent. Migration history is append-only and faithful.

## Issues Encountered

- **Research file (01-RESEARCH.md) was authored before the December 2025 FIFA Final Draw**, so its team-to-group assignments were projected, not authoritative. The original CSVs inherited that projection. zekez caught the error during the DATA-04 review and the rebuild was triggered. Future tournaments: re-verify the research data against the most recent FIFA publication before authoring CSVs.

## User Setup Required

None - no external service configuration required. The live Supabase project (`tjivukpxuhbrbshidbfv`) and `.env.local` were already configured during Plan 01-01.

## Next Phase Readiness

- **Wave 3 / Plan 01-04 (auth + UI shell)** can proceed: the tournament row, teams (with Hebrew names), fixtures, bracket slots, and props are all live and visible to authenticated users via RLS. The join flow's profile insert can reference the WC2026 tournament_id.
- **Phase 2 (League predictions)**: the 104 fixtures with UTC kickoffs are the lock anchor for LGE-04. Group-stage fixtures have team FKs resolved; knockout fixtures use symbolic placeholders that admin will resolve in Phase 2 (ADM-03).
- **Phase 2 (Props)**: the 7 prop_questions are the question set users answer pre-tournament. tournament.starts_at = 2026-06-11T19:00:00Z is the lock anchor for prop_answers RLS (PRP-03).
- **Phase 3 (Bracket)**: 32 bracket_slots are wired R32 -> CHAMPION with correct non-sequential FIFA R32->R16 pairings. Bracket picks reference slot_id, so picks survive placeholder resolution naturally (BRK-02).
- **No blockers carried forward.** All Plan 01-03 contracts met. DATA-04 sign-off recorded.

## Self-Check: PASSED

All claimed files exist on disk:
- `data/wc2026/teams.csv`, `data/wc2026/fixtures.csv`, `data/wc2026/bracket_slots.csv`, `data/wc2026/prop_questions.csv`
- `scripts/build-seed-sql.ts`
- `supabase/migrations/0005_seed_wc2026.sql`, `supabase/migrations/0006_reseed_wc2026.sql`
- `.planning/phases/01-foundation-schema-auth-rls/01-03-SUMMARY.md` (this file)

All claimed commits exist in `git log --oneline --all`:
- `7f7c978` (initial CSV authoring -- superseded)
- `e8a4741` (initial build-seed-sql + 0005 migration)
- `d8c05ed` (teams.csv rebuild with Dec 2025 draw)
- `5aeea2d` (fixtures.csv rebuild + bracket parent wiring)
- `3a2cd73` (0006 reseed migration + build-script flag extension)

---
*Phase: 01-foundation-schema-auth-rls*
*Completed: 2026-05-23*
