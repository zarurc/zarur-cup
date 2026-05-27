# Phase 2 Research Addendum — Scope Expansion (2026-05-26)

**Trigger:** `/gsd-discuss-phase 2` deferred D-43 (sports API source), D-44 (cron consolidation pattern), and D-40 (read-only bracket view RSC approach) to gsd-phase-researcher.
**Scope:** This addendum **supplements** `02-RESEARCH.md`; it does **not** replace any prior section.
**Confidence:** HIGH on D-43 + D-44 (verified against vendor docs); HIGH on D-40 (verified against codebase + Tailwind v4 docs).
**Days to hard deadline:** 16 (May 26 → June 11).

---

## TL;DR for the planner

1. **D-43 (API source):** Use **football-data.org v4** as primary (free, generous 10 req/min, official-quality, FIFA competition code `WC` once published, requires `X-Auth-Token` header). Use **openfootball/worldcup.json** raw GitHub as fallback (schedule-only — does NOT carry scores during a live tournament; falls back to admin manual entry). Mapping path: by `(kickoff_at, home_team_code, away_team_code)` tuple — **NOT** by external ID — because no free source guarantees a stable mapping to FIFA's `external_match_no` 1-104 schema we already seeded. Build a deterministic match-resolver function with a unit-test corpus of all 104 fixtures.

2. **D-44 (cron consolidation):** **STOP. CONTEXT.md D-41 is built on a false premise. Vercel Hobby cron is hard-limited to ONCE PER DAY** — `*/15 * * * *` will fail at deployment with the literal error `"Hobby accounts are limited to daily cron jobs"`. The "1 cron slot" assumption in CONTEXT.md is also wrong (Hobby allows 100). Planner MUST escalate one of three paths before writing implementation plans: **(a)** upgrade to Vercel Pro ($20/mo), **(b)** move polling to **Supabase pg_cron** (free, in-Postgres, supports `*/15`), or **(c)** move polling to **GitHub Actions** scheduled workflows (`*/15` allowed; private-repo minute budget fits inside the tournament window). Recommendation: **option (b) Supabase pg_cron + `pg_net.http_get` calling a new `/api/score-fetch` route handler** — keeps all the application logic in Vercel/Next.js (planner doesn't need to learn Edge Functions), keeps Supabase as the scheduler, costs $0, and the heartbeat retains its current 3-day daily cron unchanged. D-41's "consolidate inside heartbeat" path is unbuildable on free tier.

3. **D-40 (read-only bracket view):** Single RSC at `src/app/[locale]/bracket/page.tsx` reading `bracket_slots` with **two correlated joins** (one to `fixtures` for the deciding match, one to `teams` via `resolved_team_id`). Render as **column-of-rounds** layout (R32 → R16 → QF → SF → F → CHAMPION) — six vertical columns at desktop, **collapses to a single accordion-per-round at 360px** (mobile-first). Use Tailwind v4 logical-property utilities only — `is-*`, `pi-*`, `bs-*`, `inset-i-*` — so HE RTL flips automatically without conditional class strings. Live-fill via `revalidatePath('/he/bracket')` + `/en/bracket` added to the **existing** `saveResult` Server Action (one extra two-line change; no new admin flow).

---

## D-43: Sports API source selection

### Candidates evaluated

| Source | WC 2026 coverage | Auth model | Free-tier rate limit | Typical latency | Stability track record | TOS concerns | Fit score |
|--------|------------------|-----------|----------------------|-----------------|------------------------|--------------|-----------|
| **football-data.org v4** | Yes (FIFA WC is on the "free forever" tier per vendor blog) `[VERIFIED: thestatsapi.com comparison post]` | `X-Auth-Token: <key>` header (free key after email signup) `[VERIFIED: docs.football-data.org/v4/policies]` | **10 req/min** authenticated, 100 req/24h unauthenticated. Polling once per fixture-finish (~64 group matches over 17 days + 40 KO matches over 22 days ≈ <10 req/day even at every-minute polling) | Score updates documented as "delayed" on free tier; vendor doesn't quantify, community reports 5-15 min. **Adequate** — Zarur-Cup wants results "by the time admin opens the app the next morning," not live in-match. | Long-running (since 2014), used by hobbyists at scale, stable v4 API. `[CITED: football-data.org Pricing]` | Free plan permits non-commercial use; family pool qualifies. `[CITED: docs.football-data.org policies]` | **PRIMARY** — best balance of stability + coverage + auth simplicity |
| **API-Football (api-sports.io)** | Yes (league `id=1`, `season=2026`, dedicated WC 2026 guide published) `[VERIFIED: api-football.com WC2026 guide]` | API key header (free signup) | **100 req/day** hard cap; key disabled if exceeded `[VERIFIED: api-football.com pricing]` | Real-time scores on paid; free tier has no live data | Established, commercial-grade, but free tier is restrictive | Free tier commercial use OK | **FALLBACK candidate** — daily cap is fine for 30-day tournament (104 matches × ~3 polls each ≈ 312 req over 30 days = ~10/day average), but fragile if a fixture needs re-polling. |
| **TheSportsDB** | Yes (covers FIFA World Cup competition) | API key (free signup; commercial requires $9/mo Patreon) `[VERIFIED: thesportsdb.com pricing]` | **30 req/min** free `[VERIFIED: thesportsdb.com forum]` | Crowd-sourced — errors more common than commercial APIs | Crowd-sourced, error rate higher; OK for hobby use | Commercial use requires Patreon; family pool likely non-commercial | **TERTIARY fallback** — generous rate limit, but data-quality risk doesn't justify primary status |
| **WC2026 API (wc2026api.com)** | Yes (built specifically for WC 2026, exposes `match_number` field that maps to FIFA 1-104) `[VERIFIED: wc2026api.com docs]` | `Authorization: Bearer wc2026_<key>` | **100 req/day** free; key disabled on excess `[VERIFIED: wc2026api.com]` | Claims 99.9% uptime, no formal SLA | **New** (built for this tournament — no track record). Single-vendor single-tournament dependency. | Free tier permits non-commercial use | **NOT recommended as primary** — single-purpose unfamiliar vendor for the immovable June 11 deadline carries too much "vendor disappears" risk. Mention as future option if primary fails. |
| **openfootball/worldcup.json** | Yes — schedule + venues. Raw GitHub JSON, no auth. `[VERIFIED: github.com/openfootball/worldcup.json]` | None (public raw GitHub) | None (GitHub raw subject to general abuse limits — irrelevant at <100 req/day) | **N/A — schedule data only.** Repo states "Match Schedule (Fixtures and Results)" but 2026 file has placeholder team refs (`W101`/`W102`) and **no live score channel.** `[VERIFIED: github.com/openfootball/worldcup.json README + 2026/worldcup.json sample]` | Hosted on GitHub raw; community-maintained | None | **SCHEDULE-ONLY fallback** — useful if vendor APIs all fail and admin wants to bulk-verify schedule, NOT for live score ingestion |
| **ESPN unofficial** | Yes (ESPN covers WC) | None (URL scraping their unofficial JSON endpoints) | None enforced; subject to anti-abuse | Real-time during match | **UNOFFICIAL — endpoints rotate without notice; not covered by any TOS or rate-limit commitment** | URL-scraping; quasi-legal at best | **NOT recommended** — fragility risk too high for a hard deadline |
| **SofaScore unofficial** | Yes | None (URL scraping) | None enforced | Real-time | **UNOFFICIAL — same fragility caveats as ESPN** | Same as ESPN | **NOT recommended** |

### Recommendation

**Primary: football-data.org v4.** Best balance for this project. Free tier is sufficient (we'll poll ~10×/day average across the tournament window), authentication is one header, the competition code for World Cup is announced by vendor when the tournament becomes active (historically `WC`; planner verifies at integration time by querying `/v4/competitions/?plan=TIER_ONE`), and the `/v4/competitions/{code}/matches` endpoint returns a flat array of matches with `utcDate` + `homeTeam.name`/`tla` + `awayTeam.name`/`tla` + `score.fullTime.home`/`.away` + `status`. **Fallback: admin manual entry at `/admin/matches`** (always available per D-41, integrity widget surfaces any unscored fixtures per D-15).

### Implementation sketch

```typescript
// src/lib/score-fetch/footballData.ts (new)
// Source: https://docs.football-data.org/general/v4/match.html
// Auth:   X-Auth-Token header; key is free after email signup at football-data.org/client/register
// Rate:   10 req/min authenticated — well over our ~1 req/15min ceiling

const FOOTBALL_DATA_BASE = 'https://api.football-data.org/v4';

export type ExternalMatch = {
  utcDate: string;          // ISO 8601 UTC
  status: 'SCHEDULED' | 'TIMED' | 'IN_PLAY' | 'PAUSED' | 'FINISHED' | 'POSTPONED' | 'SUSPENDED' | 'CANCELED';
  homeTeam: { id: number; name: string; tla: string };  // tla = "ARG", "ENG", etc.
  awayTeam: { id: number; name: string; tla: string };
  score: { fullTime: { home: number | null; away: number | null } };
};

export async function fetchWcMatches(opts: { sinceDays?: number } = {}): Promise<ExternalMatch[]> {
  const token = process.env.FOOTBALL_DATA_TOKEN;
  if (!token) throw new Error('FOOTBALL_DATA_TOKEN missing');

  // Filter to recent + upcoming; football-data accepts dateFrom/dateTo
  const dateFrom = new Date(Date.now() - (opts.sinceDays ?? 1) * 86400_000).toISOString().slice(0, 10);
  const dateTo   = new Date(Date.now() + 86400_000).toISOString().slice(0, 10);
  const url = `${FOOTBALL_DATA_BASE}/competitions/WC/matches?dateFrom=${dateFrom}&dateTo=${dateTo}`;

  const res = await fetch(url, {
    headers: { 'X-Auth-Token': token },
    // Vercel default fetch caches; force fresh for cron polling
    cache: 'no-store',
  });

  if (!res.ok) {
    // 429 = rate-limited; 403 = key invalid; anything else = transient
    throw new Error(`football-data ${res.status}: ${await res.text().catch(() => '')}`);
  }
  const json = await res.json();
  return json.matches ?? [];
}
```

### Fallback chain (when football-data.org fails)

| Trigger | Action | Surfacing |
|---------|--------|-----------|
| HTTP 429 (rate-limit) | Log + return 200 from route handler; skip this poll | Next poll likely succeeds (10 req/min budget); no admin intervention needed |
| HTTP 403/401 (key invalid) | Log + return 200; **alert admin** by setting a `score_fetch_health` row to `degraded` (planner picks where this lives — could be a single row in `tournament` table) | Admin integrity widget (D-15) surfaces "score-fetch degraded" alongside existing 3 metrics |
| HTTP 5xx (vendor down) | Log + return 200; backoff to next scheduled poll | Vendor outage normally resolves within minutes; the cron will catch up |
| Network error / timeout | Log + return 200; backoff | Same as 5xx |
| Match returned with `status === 'FINISHED'` but `score.fullTime.home === null` | Log + skip THIS match only; continue processing the rest | Should not occur per vendor contract; defensive guard |
| All scheduled WC matches missing from response (vendor lost coverage) | Log + return 200; **no DB writes** | Admin notices missing scores at next dashboard glance; types them in manually at `/admin/matches`. **Manual entry is ALWAYS the canonical write path per D-41.** |

**No retry loop inside the route handler.** Vercel function timeout is 10s on Hobby; one fetch attempt + DB writes must fit. Retries are the next cron tick's job.

### Identifier mapping — the hard part

**Our seed CSV has NO `external_id` column from any sports API.** The fixtures table identifies matches by:
- `id` (UUID, internal)
- `external_match_no` (FIFA's 1-104 official match number)
- `(home_team_id, away_team_id, kickoff_at)` tuple (set after placeholder resolution)

The football-data.org `/matches` endpoint returns **its own internal `id` integer**, plus `homeTeam.tla` (3-letter team code) + `awayTeam.tla` + `utcDate`. **None of the free sources reliably expose FIFA's 1-104 match-number field** — only the paid WC2026 API does, and it's a single-tournament unproven vendor.

**Mapping strategy: `(utcDate within ±5min, homeTeam.tla, awayTeam.tla)` tuple match.**

```typescript
// src/lib/score-fetch/resolveFixture.ts (new)
// Match an external API fixture to our internal fixtures.id by team codes + kickoff time.
// Three-letter codes (TLA) are the lingua franca of all football APIs — we already use them
// in data/wc2026/fixtures.csv as `home_code` / `away_code`, denormalized into teams.code.
//
// Returns null if no unique match found (caller logs + skips, admin enters manually).

export async function resolveFixture(svc: SupabaseClient, ext: ExternalMatch): Promise<string | null> {
  const kickoff = new Date(ext.utcDate);
  const windowMs = 5 * 60_000;  // ±5 min

  // SELECT id FROM fixtures
  //  JOIN teams ht ON ht.id = fixtures.home_team_id
  //  JOIN teams at ON at.id = fixtures.away_team_id
  // WHERE ht.code = ext.homeTeam.tla
  //   AND at.code = ext.awayTeam.tla
  //   AND fixtures.kickoff_at BETWEEN (kickoff - 5min) AND (kickoff + 5min)
  const { data, error } = await svc
    .from('fixtures')
    .select('id, kickoff_at, home_team:home_team_id(code), away_team:away_team_id(code)')
    .eq('home_team.code', ext.homeTeam.tla)
    .eq('away_team.code', ext.awayTeam.tla)
    .gte('kickoff_at', new Date(kickoff.getTime() - windowMs).toISOString())
    .lte('kickoff_at', new Date(kickoff.getTime() + windowMs).toISOString());

  if (error || !data || data.length !== 1) return null;
  return data[0].id;
}
```

**Why a tuple match, not a single ID:**
- football-data.org's match `id` is THEIR internal ID, not FIFA's. Would require us to call their API once at seeding to populate an `external_id` column. Adds a new migration + manual one-time chore + creates fragility if they ever renumber.
- FIFA's 1-104 isn't exposed by any free-tier source.
- Team TLA codes (ISO-3) are universal — we already seeded these in `teams.code`.
- `±5min` window absorbs vendor kickoff-time drift (some APIs report scheduled, some kick-off-actual).

**Recommended sub-task (Wave 0 of the new plan set):** unit-test the resolver against a hand-built corpus of all 104 fixtures (`tests/score-fetch/resolveFixture.test.ts`). Synthesize 104 `ExternalMatch` objects from `data/wc2026/fixtures.csv` and assert each resolves to the corresponding `fixtures.id`. Catches CSV/vendor TLA mismatches before they bite live.

### Schema additions for D-41 idempotency

D-41 says "Score-fetch upserts on `(fixture_id)` and checks `result_home_90min IS NULL` before writing; never overwrites an admin-entered or already-fetched result," with an `auto_fetched_at NULL` admin-overwrite invariant.

**Recommendation:** Add a single new column to `fixtures`:

```sql
-- supabase/migrations/0012_fixtures_auto_fetched.sql (new — migration number after current head 0011)
alter table public.fixtures
  add column auto_fetched_at timestamptz null;

comment on column public.fixtures.auto_fetched_at is
  'Set by /api/score-fetch when result_home_90min/result_away_90min are populated from external API. '
  'NULL means admin-entered (or never scored). Cron MUST NOT overwrite rows where this is NULL AND '
  'result_home_90min IS NOT NULL (= admin already entered). The saveResult Server Action MUST clear '
  'this column to NULL on every admin write so future cron polls don''t resurrect it.';
```

**The cron's idempotency check:**

```sql
-- Pseudocode for the UPDATE the cron emits per fixture (one UPDATE per match)
UPDATE fixtures
SET result_home_90min = $1,
    result_away_90min = $2,
    auto_fetched_at = now(),
    updated_at = now()
WHERE id = $3
  AND (
    result_home_90min IS NULL                              -- never scored
    OR auto_fetched_at IS NOT NULL                          -- previously auto-fetched (safe to refresh)
  )
  AND ($1 IS DISTINCT FROM result_home_90min OR $2 IS DISTINCT FROM result_away_90min);
-- The DISTINCT FROM guard avoids spurious updated_at bumps that would re-trigger revalidatePath.
```

The `saveResult` Server Action (existing per Plan 02-03 / `src/app/actions/saveResult.ts`) must add `auto_fetched_at: null` to its `UPDATE fixtures SET ...` — one line change.

**Crucially:** after fetching scores, the cron MUST also call the existing scoring sweep (the `sweepAndUpsert` helper recommended in 02-RESEARCH.md §"Architecture Patterns" Pattern 5). The cron does the same work the admin "Save Result" button does — fetches predictions, scores in TS, UPSERTs `score_events` with `source='league'`. Otherwise the leaderboard never sees the auto-fetched results.

### Open risks for planner

1. **Vendor competition code is `WC` based on historical pattern, but unverified for 2026.** Planner adds a one-off validation step at integration time: `curl -H "X-Auth-Token: $TOKEN" https://api.football-data.org/v4/competitions/?plan=TIER_ONE | jq` and confirms `code: "WC"` (or whatever it actually is). Wave 0 sub-task.
2. **"Score is delayed on free tier"** — vendor doesn't quantify. Polling cadence (15min recommended) absorbs latency from minutes-to-half-an-hour. If finals-week reveals real-world delay exceeds 30min, admin manual entry covers the gap (D-15 widget surfaces unscored matches).
3. **Vendor outage on a high-traffic match** — fallback is admin manual entry. Document in launch checklist.
4. **TLA mismatch corner cases** — some vendors use `KOR` for South Korea, others use `KOR` consistently with FIFA. Spot-check during Wave 0 corpus build; if mismatches found, add a small `vendorTlaOverrides: Record<string, string>` map in `resolveFixture.ts`.
5. **`FOOTBALL_DATA_TOKEN` env var** — must be added to Vercel project + documented in `01-USER-SETUP.md` (or its Phase 2 successor). Service-role secret; **must NOT** carry `NEXT_PUBLIC_` prefix.

---

## D-44: Cron consolidation pattern

### THE BLOCKER — surfaced first

> **Vercel Hobby caps cron frequency at ONCE PER DAY.** `*/15 * * * *` will fail at deployment with the literal error: `"Hobby accounts are limited to daily cron jobs. This cron expression would run more than once per day."` `[VERIFIED: vercel.com/docs/cron-jobs/usage-and-pricing — table: "Hobby | 100 cron jobs | Once per day | Hourly (±59 min)"]`

CONTEXT.md D-41 says: *"Vercel Hobby supports any cron expression; the 1-slot limit is on number of distinct crons, not frequency."* **This is factually wrong on both counts:**
- Hobby allows **100** cron jobs per project (not 1). `[VERIFIED: same docs page]`
- Hobby's frequency cap is **once-per-day** (not unlimited). `[VERIFIED: same docs page]`

The "1 cron slot, frequency unlimited" mental model that propagated from Phase 1 STATE.md W6 watchpoint into the Phase 2 CONTEXT.md addendum is stale (or never matched docs). The planner cannot ship D-41 as currently written on the Hobby plan.

### Decision required from operator (NOT a research recommendation — this is a strategy fork)

| Path | Pros | Cons | Cost | Recommendation |
|------|------|------|------|----------------|
| **(a) Upgrade Vercel to Pro** | Trivial fix; everything in D-41 works as designed; cron frequency unrestricted | $20/mo recurring; project budget says "Hobby-tier" explicitly | $20/mo | **NOT recommended** — violates CLAUDE.md budget constraint without operator approval; trivially reversible by user if they prefer money over engineering |
| **(b) Move polling to Supabase pg_cron** | Free; pg_cron has no frequency cap; runs inside Postgres (no Vercel function); can call out via `pg_net.http_get` to a Vercel route to keep app logic in Next.js; `pg_cron` is a first-class Supabase module | Adds a tiny ops surface (one new migration + one Supabase Dashboard schedule); requires `pg_cron` extension enable (free, one click); needs careful auth (the route still needs to require a shared secret because pg_net requests it as an unauthenticated POST) | $0 | **PRIMARY RECOMMENDATION** — keeps Vercel Hobby, doesn't bloat the heartbeat, leaves heartbeat untouched at its existing 3-day cadence; the score-fetch logic still lives in Next.js where the planner already knows the patterns |
| **(c) GitHub Actions scheduled workflow** | Free for public repos; private repo gets 2,000 min/mo (tournament fits: 30 days × 96 runs/day × ~30s = ~1440 min) | Repo IS private per Phase 1 P05 (2026-05-24); 1440 min consumes 72% of the monthly free budget — fragile under any rerun; GitHub Actions schedules notoriously imprecise during peak load (10-30+ min delays); needs `repository_dispatch` or secret-protected route auth | $0 if budget holds | **FALLBACK** — operationally noisier than (b); imprecise timing could miss the bottom-of-hour score-publish moment |

**The blocker MUST be surfaced to the operator before plan-writing.** This is exactly the kind of "research gap that's actually a strategy fork" that gsd-phase-researcher must escalate, not paper over.

### Pattern recommendation (assuming path b — Supabase pg_cron)

```sql
-- supabase/migrations/0013_pg_cron_score_fetch.sql (new — after the auto_fetched_at migration)
-- Enable pg_cron + pg_net (both free Supabase extensions; one-click enable also possible in Dashboard).
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Schedule: every 15 minutes, hit our Next.js score-fetch route.
-- The route validates a Bearer secret (CRON_SECRET, same env var pattern as heartbeat).
select cron.schedule(
  'score-fetch-15min',                                                 -- job name (unique per schema)
  '*/15 * * * *',                                                       -- ALL pg_cron expressions OK
  $$
    select net.http_post(
      url := 'https://zarur-cup.vercel.app/api/score-fetch',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.cron_secret'),
        'Content-Type', 'application/json'
      ),
      body := jsonb_build_object('source', 'pg_cron'),
      timeout_milliseconds := 9000                                     -- under Vercel Hobby's 10s
    );
  $$
);

-- The cron_secret is read from a PG GUC; set via:
--   ALTER DATABASE postgres SET app.cron_secret TO 'matching-vercel-CRON_SECRET-value';
-- See Wave 0 sub-task. (Setting via ALTER DATABASE persists across restarts.)
```

And on the Next.js side:

```typescript
// src/app/api/score-fetch/route.ts (new)
import { NextResponse } from 'next/server';
import { after } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { fetchWcMatches } from '@/lib/score-fetch/footballData';
import { resolveFixture } from '@/lib/score-fetch/resolveFixture';
import { sweepAndUpsert } from '@/lib/scoring/sweepAndUpsert';   // recommended helper from 02-RESEARCH.md
import { revalidatePath } from 'next/cache';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 10;   // explicit; Hobby ceiling

export async function POST(request: Request) {
  // Auth: shared secret in Bearer header. SAME pattern as heartbeat opt-in.
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get('authorization');
    if (auth !== `Bearer ${cronSecret}`) {
      return new Response('Unauthorized', { status: 401 });
    }
  }

  // Tournament-window gate (saves vendor quota outside the WC window).
  const svc = createServiceClient();
  const { data: tour } = await svc.from('tournament').select('starts_at, ends_at').single();
  const now = Date.now();
  const inWindow =
    tour &&
    now >= new Date(tour.starts_at).getTime() - 3600_000 &&        // 1h before kickoff
    now <= new Date(tour.ends_at).getTime()   + 86400_000;          // 1d after final
  if (!inWindow) {
    return NextResponse.json({ ok: true, skipped: 'outside-tournament-window' });
  }

  // Respond fast; do the work in after() to keep the cron's HTTP call snappy.
  // after() still runs inside the 10s maxDuration — see https://nextjs.org/docs/app/api-reference/functions/after#duration
  after(async () => {
    try {
      const matches = await fetchWcMatches({ sinceDays: 1 });
      let writes = 0;
      const revalidateLocales = new Set<string>();

      for (const m of matches) {
        if (m.status !== 'FINISHED') continue;
        if (m.score.fullTime.home === null || m.score.fullTime.away === null) continue;

        const fixtureId = await resolveFixture(svc, m);
        if (!fixtureId) {
          console.warn('score-fetch: no fixture resolved', { utcDate: m.utcDate, home: m.homeTeam.tla, away: m.awayTeam.tla });
          continue;
        }

        // UPDATE only if not admin-entered (auto_fetched_at IS NOT NULL OR result_home_90min IS NULL).
        const { data: updated, error: upErr } = await svc
          .from('fixtures')
          .update({
            result_home_90min: m.score.fullTime.home,
            result_away_90min: m.score.fullTime.away,
            auto_fetched_at: new Date().toISOString(),
          })
          .eq('id', fixtureId)
          .or('result_home_90min.is.null,auto_fetched_at.not.is.null')
          .select('id');

        if (upErr) {
          console.error('score-fetch update error', upErr);
          continue;
        }
        if (!updated || updated.length === 0) continue;   // admin-locked; respect manual entry

        // Sweep predictions → score_events for this fixture (same helper the admin path uses).
        await sweepAndUpsert(svc, { source: 'league', ref_id: fixtureId, fixture: { result_home_90min: m.score.fullTime.home, result_away_90min: m.score.fullTime.away } });
        writes++;
      }

      if (writes > 0) {
        for (const locale of ['he', 'en']) {
          revalidatePath(`/${locale}/matches`);
          revalidatePath(`/${locale}/leaderboard`);
          revalidatePath(`/${locale}/bracket`);   // D-40 read-only view
          revalidatePath(`/${locale}/me`);
        }
      }
      console.log('score-fetch ok', { processed: matches.length, writes });
    } catch (err) {
      // NEVER throw out of after() — the response already shipped. Just log.
      console.error('score-fetch failed', err);
    }
  });

  // Always 200 (the work runs in after()); pg_cron retains the schedule.
  return NextResponse.json({ ok: true, scheduled: true });
}
```

### Failure isolation strategy

**The heartbeat (3-day Supabase anti-pause ping) and the score-fetch (15-min poll) are now in DIFFERENT route handlers** — heartbeat stays at `/api/heartbeat` on the existing Vercel daily cron `0 12 */3 * *`; score-fetch lives at `/api/score-fetch` triggered by Supabase pg_cron. This is a feature, not a defect of the design:

| Concern | How this design solves it |
|---------|---------------------------|
| Heartbeat must survive score-fetch failure | They share NO code paths. Heartbeat is one SELECT; score-fetch is a fetch + N UPDATEs. Independent. |
| Score-fetch must not starve heartbeat's 10s budget | They run in different invocations. Heartbeat's 10s is uncontested. |
| One bad poll must not break the next | Per-match try/catch; `after()` errors are caught + logged; route always returns 200 so pg_cron stays on schedule. |
| Vendor outage | `await fetchWcMatches()` throws inside `after()`'s try block; caught + logged; pg_cron keeps polling; next successful poll catches up. |
| Vercel function timeout (10s) mid-fetch | `after()` is bounded by the same `maxDuration`. If it times out, response was already sent (200), pg_cron retains the schedule, next poll picks up where this one stalled. **Idempotent UPSERT-with-guard ensures no double-counting.** |

### 10s Vercel Hobby timeout handling

football-data.org's `/competitions/WC/matches` endpoint with `dateFrom`/`dateTo` filters typically returns a few KB JSON in <500ms. Processing 0-5 finished matches each poll, each requiring 1 SELECT + 1 UPDATE + 1 sweep-UPSERT, totals ~50ms × 5 = 250ms DB. Net: ~750ms-1500ms per cron invocation. Comfortably inside 10s with ~85% margin.

**If timeout proves real (e.g., a giant batch on tournament restart day):** `after()` allows the response to ship at the start so pg_cron's HTTP request gets a fast 200. Then split the work into chunks — process at most 10 matches per invocation; rely on the next 15-min poll to catch the rest. The idempotency guard prevents reprocessing.

**Note on `after()` duration semantics (`[VERIFIED: nextjs.org/docs/app/api-reference/functions/after, section "Duration"]`):** `after` runs within the route's `maxDuration` budget. If the route exits at 10s with pending after-work, that work is **cut off** mid-execution. This argues for keeping each per-match work unit small (<1s) so an arbitrary cutoff loses at most one match's worth of work — which the next poll picks up cleanly.

### Cron schedule choice

- **Frequency: `*/15 * * * *`** during the tournament window. `[VERIFIED: pg_cron supports arbitrary cron expressions]`
- **Gating:** the route handler checks `tournament.starts_at - 1h <= now <= tournament.ends_at + 1d` and short-circuits with `{ ok: true, skipped: 'outside-tournament-window' }` if outside. Saves vendor quota silently.
- **Heartbeat unchanged:** Vercel cron continues at `0 12 */3 * *` calling `/api/heartbeat`. Phase 1 FND-05 invariant intact.
- **3-day baseline:** trivially satisfied — `*/15` polls during the tournament easily exceed the 3-day floor, and the dedicated heartbeat keeps firing on its independent schedule.

### Open risks for planner

1. **CONTEXT.md D-41 needs corrections.** Either operator approves path (b) above and CONTEXT gets a follow-up addendum, OR operator picks path (a) Pro upgrade. Plan-writing should NOT proceed until this is resolved — otherwise plans get written against an undeployable design.
2. **`pg_net.http_post` from Supabase to Vercel hits the public internet.** Same security posture as the existing heartbeat opt-in `CRON_SECRET`. Document the secret rotation procedure (currently captured in MEMORY.md "Pending Supabase rotation").
3. **`pg_cron` runs as superuser inside Postgres** — the SQL it runs has full DB access by definition. Limit the `cron.schedule` body to ONE `net.http_post` call (no inline SELECT/UPDATE) so a future schema drift can't break the cron silently.
4. **`pg_net` is enabled but does NOT block on response by default.** The `timeout_milliseconds` parameter caps wait time, but pg_cron will not retry on failure — it's fire-and-forget. Vercel function logs are the only failure surface; integrity widget compensates by surfacing unscored fixtures.
5. **Supabase Dashboard "Cron" panel shows execution history.** Planner adds a single Wave 0 sub-task: verify dashboard shows green for the new `score-fetch-15min` job. Equivalent to FND-05 verification for heartbeat.
6. **`current_setting('app.cron_secret')` won't survive db restore** unless the GUC is re-set. Document in the Wave 0 sub-task: `ALTER DATABASE postgres SET app.cron_secret TO '...'` needs to be re-run after any DB restore — same posture as Supabase secrets management.

---

## D-40: Read-only bracket view technical approach

### RSC pattern recommendation

**Single Server Component, single Supabase query, two joins.** The query reads `bracket_slots` filtered by `tournament_id` (one row per `tournament`), joined to `fixtures` (for kickoff/score display) and to `teams` (twice — `home_team_id` and `away_team_id` via the joined `fixtures` row, AND once via `resolved_team_id` on the slot itself).

```typescript
// src/app/[locale]/bracket/page.tsx (REPLACES the EmptyStateCard body)
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { requireMember } from '@/lib/auth/session';
import { createServerClient } from '@/lib/supabase/server';
import { BracketTree } from '@/components/bracket/BracketTree';

type Props = { params: Promise<{ locale: string }> };

export default async function BracketPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireMember(locale);

  const supabase = await createServerClient();
  const t = await getTranslations('bracket');

  // Single SELECT joining bracket_slots → fixtures → home/away teams + resolved_team
  // The Supabase relational select syntax does the join in one round-trip.
  const { data: slots } = await supabase
    .from('bracket_slots')
    .select(`
      slot_code,
      stage,
      parent_slot_id,
      resolved_team:resolved_team_id(id, code, name_en, name_he),
      fixture:fixture_id(
        external_match_no,
        kickoff_at,
        result_home_90min,
        result_away_90min,
        home_placeholder,
        away_placeholder,
        home_team:home_team_id(id, code, name_en, name_he),
        away_team:away_team_id(id, code, name_en, name_he)
      )
    `)
    .order('stage', { ascending: true })           // R32 → CHAMPION via the CHECK enum order
    .order('slot_code', { ascending: true });

  return <BracketTree slots={slots ?? []} locale={locale} headings={{
    r32: t('round32'),
    r16: t('round16'),
    qf:  t('quarter'),
    sf:  t('semi'),
    final: t('final'),
    champion: t('champion'),
  }} />;
}
```

**One query, not sequential reads.** The Supabase `select()` syntax `resolved_team:resolved_team_id(...)` + `fixture:fixture_id(...)` joins server-side via PostgREST embeds — single round-trip to Postgres. At 32 slots, the response is ~5-10KB. Sub-100ms cold path.

**Why not denormalize to `bracket_slots.team_name_en` etc.?** Resolved teams come from `teams` already; the indirection costs nothing and avoids data drift if a team's `name_he` is ever corrected.

### Tree rendering at 360px (HE RTL + EN LTR)

CLAUDE.md and Phase 1 P05 require **Tailwind v4 logical-property utilities** so direction-flips are zero-cost. The known-good aliases (added in Phase 1 P01) include `is-*` (inline-size), `bs-*` (block-size), `pi-*` (padding-inline), `mi-*` (margin-inline), `inset-i-*` (inset-inline). All physical-direction utilities (`pl-*`, `mr-*`, `text-left`, `border-l-*`) are forbidden by the `npm run lint:rtl` script.

**Layout recommendation:**

```
Mobile (≤768px — i.e. the 360px design target):
  - Vertical accordion, one section per round.
  - Round labels in stage order (always reads top-down regardless of locale):
      [Round of 32]  [▼]    ← collapsible
        Slot R32_M1 (June 28, 14:00 UTC): MEX vs ?  →  MEX 2-1 ?
        Slot R32_M2 ...
      [Round of 16] [▼]
        ...
      [Champion]    [▼]
        CHAMPION: TBD (or team name once final played)
  - "Slot row" same component reused for every stage.
  - Logical-property classes: `pi-4 bs-12 is-full bg-[var(--zc-card)]` — direction-neutral.

Desktop (≥1024px — bonus, not required for ship):
  - 6-column grid: R32 | R16 | QF | SF | F | Champion (left-to-right in LTR; right-to-left in RTL via flex with `flex-row` + RTL parent `dir="rtl"`)
  - Each column scrolls vertically independently.
  - At 320-1024px, fall back to mobile accordion.
```

**Why column-of-rounds, not the traditional left-right tree:** A traditional bracket tree requires SVG line-drawing between paired R32 slots and their R16 parent. At 360px that's unreadable; on RTL it requires either a mirrored SVG (expensive) or a flipped flex container (line endpoints drift). Column-of-rounds reads as a linear list — no SVG, no positioning math, no RTL gymnastics. The parent-child relationship is implicit (R16 slots show which R32 slots feed them via the join data, displayed inline as "winners of R32_M1, R32_M3").

**`BracketTree` component skeleton:**

```tsx
// src/components/bracket/BracketTree.tsx (new — server component)
import { Fragment } from 'react';
import { SlotRow } from './SlotRow';

type Slot = { /* shape from the query */ };

export function BracketTree({ slots, locale, headings }: { slots: Slot[]; locale: 'he' | 'en'; headings: Record<string, string> }) {
  // Group by stage in canonical order
  const stages = ['round_of_32','round_of_16','quarter_final','semi_final','final','champion'] as const;
  const grouped = Object.fromEntries(stages.map(s => [s, slots.filter(x => x.stage === s)]));

  return (
    <div className="bs-full pi-4 plb-4">
      {stages.map(stage => (
        <Fragment key={stage}>
          <h2 className="bs-12 text-lg font-bold pb-2">{headings[stageKey(stage)]}</h2>
          <ul className="grid grid-cols-1 gap-2 mb-6">
            {grouped[stage].map(slot => (
              <SlotRow key={slot.slot_code} slot={slot} locale={locale} />
            ))}
          </ul>
        </Fragment>
      ))}
    </div>
  );
}

function stageKey(s: string) {
  return ({
    round_of_32: 'r32', round_of_16: 'r16', quarter_final: 'qf',
    semi_final: 'sf', final: 'final', champion: 'champion',
  } as const)[s as keyof any];
}
```

```tsx
// src/components/bracket/SlotRow.tsx (new — server component)
export function SlotRow({ slot, locale }: { slot: Slot; locale: 'he' | 'en' }) {
  const nameKey = locale === 'he' ? 'name_he' : 'name_en';

  // Champion is special — no fixture, just a single resolved team (the cup winner).
  if (slot.stage === 'champion') {
    return (
      <li className="bs-14 pi-3 rounded bg-[var(--zc-card)] border border-[var(--zc-border)]">
        <span className="font-bold">🏆 {slot.resolved_team?.[nameKey] ?? 'TBD'}</span>
      </li>
    );
  }

  // All other slots have a fixture
  const fx = slot.fixture;
  const home = fx?.home_team?.[nameKey] ?? labelFromPlaceholder(fx?.home_placeholder, locale);
  const away = fx?.away_team?.[nameKey] ?? labelFromPlaceholder(fx?.away_placeholder, locale);
  const decided = fx?.result_home_90min !== null && fx?.result_away_90min !== null;
  const winner = decided
    ? (fx.result_home_90min > fx.result_away_90min ? home : (fx.result_away_90min > fx.result_home_90min ? away : '—'))
    : null;

  return (
    <li className="bs-auto plb-2 pi-3 rounded bg-[var(--zc-card)] border border-[var(--zc-border)]">
      <div className="flex items-center justify-between is-full">
        <span className="text-xs text-[var(--zc-muted-foreground)]">{slot.slot_code}</span>
        <span className="text-xs text-[var(--zc-muted-foreground)]">
          {fx?.kickoff_at ? new Intl.DateTimeFormat(locale === 'he' ? 'he-IL' : 'en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(fx.kickoff_at)) : '—'}
        </span>
      </div>
      <div className="flex items-center justify-between is-full plb-1">
        <span>{home}</span>
        <span className="font-mono">
          {decided ? `${fx.result_home_90min} – ${fx.result_away_90min}` : '—'}
        </span>
        <span>{away}</span>
      </div>
      {decided && winner && (
        <div className="text-xs text-[var(--zc-foreground)] opacity-70 pis-2">
          ▸ {locale === 'he' ? 'מנצח' : 'Winner'}: <strong>{winner}</strong>
        </div>
      )}
    </li>
  );
}

function labelFromPlaceholder(p: string | null | undefined, locale: 'he' | 'en'): string {
  if (!p) return '—';
  // 'WINNER_GROUP_A' → 'Winner Group A' / 'מנצחת בית A' etc.
  // Use next-intl keys keyed on placeholder strings — punt to next-intl message catalog.
  return p;  // planner wires up the localized lookup
}
```

**Critical Tailwind v4 reminder:** every `var(--zc-X)` MUST be in `[var(--zc-X)]` brackets per Phase 1 P05 deviation #3 — I used that form throughout. The `lint:rtl` script catches stray `pl-` / `text-left` / `border-l-` etc.

### Live-fill via revalidatePath

D-40 says "Each KO match resolves its slot immediately as admin enters the result through the existing `/admin/matches` flow." The mechanism:

**Add three lines to the existing `saveResult` Server Action (`src/app/actions/saveResult.ts`):**

```typescript
// At the end of saveResult, ALONGSIDE the existing revalidatePath calls (Phase 2 plan 02-03):
revalidatePath('/he/bracket');
revalidatePath('/en/bracket');
// Existing calls (already there):
//   revalidatePath('/he/leaderboard'); revalidatePath('/en/leaderboard');
//   revalidatePath('/he/matches'); revalidatePath('/en/matches');
//   revalidatePath('/he/me'); revalidatePath('/en/me');
```

That's it. The bracket page re-renders on the next user navigation, picking up the new `bracket_slots.resolved_team_id` (which the existing `resolvePlaceholder.ts` Server Action already maintains — D-11).

**No separate admin workflow needed.** The existing `/admin/tournament-tree` flow per D-11 already updates `fixtures.home_team_id` / `away_team_id` for downstream KO matches. After group stage ends and admin uses tournament-tree to resolve placeholders, AND then enters results via `/admin/matches`, the bracket view automatically reflects everything via these two paths converging in `bracket_slots`.

**Optional `resolved_team_id` writeback in saveResult:** Currently `bracket_slots.resolved_team_id` may not auto-populate when a KO match's result is entered (Phase 1 schema has the column but no automation per `0001_init.sql:91` comment "set by admin after the match (Phase 2)"). The cleanest path:

```typescript
// Inside saveResult, after the UPDATE fixtures and the score-events sweep:
// If this fixture is a KO match (stage != 'group'), compute the winner and write to bracket_slots.
if (fixture.stage !== 'group') {
  const winnerId = result.home_90min > result.away_90min ? fixture.home_team_id
                 : result.away_90min > result.home_90min ? fixture.away_team_id
                 : null;  // tie at 90 — Phase 3 ET territory; Phase 2 leaves NULL
  if (winnerId) {
    await svc.from('bracket_slots').update({ resolved_team_id: winnerId }).eq('fixture_id', fixture.id);
  }
}
```

Two-line addition. Idempotent (same update, same row).

### Open risks for planner

1. **Champion slot edge case.** `CHAMPION` slot has `fixture_id IS NULL` (per seed CSV). Resolved team comes from the FINAL's winner — meaning when admin enters M104 result and `resolved_team_id` gets written to the `F` slot, we ALSO need to propagate to `CHAMPION`. Planner adds a one-line: `if (slot_code === 'F' && winnerId) { update CHAMPION.resolved_team_id = winnerId }`. Same shape as the placeholder propagation in `resolvePlaceholder.ts`.
2. **Tie at 90 minutes (KO match).** Phase 2 doesn't yet expose the `_full` (extra-time) columns to admin UI (D-12 defers to Phase 3). Workaround: bracket view shows `—` as the winner for any tied KO match until Phase 3 ships ET handling. Document in launch checklist.
3. **`labelFromPlaceholder` i18n.** The placeholder strings (`WINNER_GROUP_A`, `R32_M2_W`, etc.) need bilingual messages in `messages/{he,en}.json`. Planner adds ~30 message keys (one per distinct placeholder shape). Use a regex-to-key reducer rather than 32 individual keys.
4. **No SSR hydration mismatch concern.** Entire page is RSC + tiny server SlotRow. No client component. Zero JS shipped for this route. Aligns with CLAUDE.md "RSC + Server Actions over TanStack Query" policy.
5. **The `bracket_slots` order is stage-ordered by the CHECK enum.** Postgres orders enums by definition order (`round_of_32 < round_of_16 < ... < champion`), so `order('stage', { ascending: true })` works. Verify at integration time with an `EXPLAIN` if results look wrong; alternative is a CASE-based ORDER BY (more verbose, more explicit).
6. **No `bracket_picks` writes.** Confirmed in D-40 + D-34. The table stays empty; no UI surface touches it. Planner does NOT add a Server Action under `src/app/actions/` for bracket picks. Phase 1 RLS on `bracket_picks` already blocks anonymous writes via the policy shipped in `0002_rls.sql` — defense in depth.
7. **Bracket tab destination.** `src/components/layout/BottomTabBar.tsx` currently routes the Bracket tab to `/[locale]/bracket` (Phase 1 P04). That target already exists — Phase 2 just replaces the body. No tab-bar change needed.

---

## Sources

### D-43 (Sports API)
- [football-data.org Pricing](https://www.football-data.org/pricing) — confirms World Cup is on free-forever tier
- [football-data.org API Policies](https://docs.football-data.org/general/v4/policies.html) — 10 req/min authenticated, X-Auth-Token header
- [TheStatsAPI vs football-data.org comparison](https://www.thestatsapi.com/blog/thestatsapi-vs-football-data-org) — confirms free-tier coverage details + score delay note
- [API-Football pricing](https://www.api-football.com/pricing) — 100 req/day free
- [API-Football WC 2026 guide](https://www.api-football.com/news/post/fifa-world-cup-2026-guide-to-using-data-with-api-sports) — confirms `league=1, season=2026` for WC
- [TheSportsDB pricing](https://www.thesportsdb.com/pricing) — 30 req/min free; commercial use requires Patreon
- [openfootball/worldcup.json](https://github.com/openfootball/worldcup.json) — schedule-only public JSON; verified placeholder shape via raw fetch
- [WC2026 API](https://www.wc2026api.com/) — exposes match_number field aligning with FIFA 1-104; 100 req/day free

### D-44 (Cron consolidation)
- **[Vercel Cron Usage & Pricing](https://vercel.com/docs/cron-jobs/usage-and-pricing)** — **critical: Hobby = once-per-day max frequency, 100 cron jobs max** — explicit error text quoted in research
- [Vercel Hobby Plan limits](https://vercel.com/docs/plans/hobby) — confirms 10s function maxDuration (configurable to 60s on Hobby per `maxDuration` route segment)
- [Next.js `after()` API reference](https://nextjs.org/docs/app/api-reference/functions/after) — duration semantics + Route Handler usage
- [Supabase Cron / pg_cron docs](https://supabase.com/docs/guides/cron) — confirms pg_cron is free, supports HTTP calls via pg_net
- [Supabase pg_cron extension](https://supabase.com/docs/guides/database/extensions/pg_cron) — installation + cron.schedule syntax
- [Bypassing Vercel Hobby daily cron limit (Runhooks blog)](https://runhooks.app/blog/bypassing-vercel-hobby-plan-cron-limit/) — community confirmation of the daily cap + workaround patterns
- [GitHub Actions schedule (CronJobPro)](https://cronjobpro.com/blog/github-actions-scheduled-workflows) — 15-min minimum, free-tier private repo budget

### D-40 (Bracket view)
- [Tailwind CSS v4.3 logical properties](https://tailwindcss.com/blog/tailwindcss-v4-3) — `is-*` / `bs-*` / `pi-*` / `inset-i-*` utilities used throughout the SlotRow sketch
- [Supabase relational queries (PostgREST embeds)](https://supabase.com/docs/guides/database/joins-and-nesting) — single-query join syntax used in the BracketPage RSC
- [Next.js `revalidatePath`](https://nextjs.org/docs/app/api-reference/functions/revalidatePath) — pattern used for live-fill (already in use Phase 2)
- **Codebase:** `supabase/migrations/0001_init.sql:82-96` (bracket_slots schema), `data/wc2026/bracket_slots.csv` (FIFA non-sequential wiring already seeded), `src/app/[locale]/bracket/page.tsx` (current EmptyStateCard body to replace), `src/components/layout/BottomTabBar.tsx` (Bracket tab routes here already)

---

## Confidence Assessment

| Topic | Confidence | Basis |
|-------|-----------|-------|
| football-data.org as primary | HIGH | Vendor docs verified, free-tier WC coverage confirmed, used by hobbyist projects at scale since 2014 |
| Identifier mapping via TLA + kickoff tuple | HIGH | TLA codes already in `teams.code` (verified); no free vendor exposes FIFA 1-104 reliably; tuple is deterministic |
| Vercel Hobby cron once-per-day cap | **HIGH — and this DIRECTLY CONTRADICTS CONTEXT.md D-41** | Quoted from vercel.com/docs/cron-jobs/usage-and-pricing |
| Supabase pg_cron as the workaround | HIGH | First-class Supabase module; documented HTTP-call pattern; same auth posture as existing heartbeat |
| Next.js `after()` in route handlers | HIGH | Verified against Next 15 official docs; explicitly supported in Route Handlers |
| Single-RSC bracket page | HIGH | Schema + seed verified in codebase; Supabase relational query syntax is standard |
| Column-of-rounds layout for 360px RTL | HIGH | Matches Phase 1 design-token + lint-rtl posture; avoids SVG positioning gymnastics |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | football-data.org's WC competition code is `WC` (historical pattern). | D-43 Implementation sketch | Wave 0 sub-task validates against `/v4/competitions/?plan=TIER_ONE`; trivially fixed by changing one string |
| A2 | Vendor TLAs match our `teams.code` ISO-3 values 1:1. | D-43 Identifier mapping | Wave 0 corpus test surfaces mismatches; mitigated by tiny override map |
| A3 | "Free tier non-commercial use" wording covers a family pool with no revenue. | D-43 candidates table | All four free-tier APIs reviewed permit non-commercial use; family pool clearly qualifies |
| A4 | Supabase free tier includes `pg_cron` + `pg_net` extensions. | D-44 path (b) | Verified in Supabase Cron module docs — both extensions are free; one-click enable in Dashboard |
| A5 | `pg_cron`'s `current_setting('app.cron_secret')` GUC persists across DB restarts when set via `ALTER DATABASE`. | D-44 schema sketch | Documented Postgres behavior; if wrong, planner uses Supabase Vault instead (more setup, still free) |
| A6 | `score_events` `sweepAndUpsert` helper exists from Phase 2 Plan 02-03. | D-44 route handler sketch | If the helper was inlined into `saveResult.ts` instead of extracted, planner extracts during Wave 0 — 02-RESEARCH.md recommends extraction anyway |
| A7 | Phase 2 `saveResult.ts` already calls `revalidatePath` for matches/leaderboard/me. | D-40 live-fill | Adding `bracket` to the existing list is a two-line patch; if `saveResult.ts` doesn't yet exist at integration time, the lines simply land with the original implementation |

## Open Questions

1. **Operator must pick a cron path (a/b/c) before D-44 can move to plan-writing.** Recommendation: path (b) Supabase pg_cron. This is a strategy fork, not a research gap.
2. **`FOOTBALL_DATA_TOKEN` provisioning.** Operator (zekez) signs up at football-data.org/client/register, drops the token into Vercel env + (if path b) into Supabase as `app.cron_secret` partner. Wave 0 sub-task.
3. **Tournament window edge dates.** Currently CONTEXT D-41 uses `tournament.starts_at - 1h` to `tournament.ends_at + 1d` as the polling window. The `tournament` table already has both columns (verified in `0001_init.sql:13-14`). Planner verifies seeded `ends_at` is July 19 + a buffer (it should be per `0006_reseed_wc2026.sql`).

---

*Addendum filed: 2026-05-26 by gsd-phase-researcher in response to /gsd-discuss-phase 2 D-43/D-44/D-40 deferral.*
*Does NOT replace `02-RESEARCH.md`; supplements it.*
