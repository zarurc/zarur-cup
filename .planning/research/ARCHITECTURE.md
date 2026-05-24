# Architecture Research

**Domain:** Bilingual prediction-pool web app (Next.js App Router + Supabase) for FIFA World Cup 2026
**Researched:** 2026-05-23
**Confidence:** HIGH for stack patterns (Context7-grade docs widely available); MEDIUM for the bespoke "shared invite-code identity" pattern (no off-the-shelf recipe — synthesized from Supabase anonymous-auth + custom claim primitives).

Three opinionated calls drive everything below:

1. **Server-rendered first.** Server Components hit Postgres directly; Server Actions handle every write. Client Components are a deliberate minority (pickers, locale toggle, real-time-ish leaderboard refresh). This is cheap on Vercel free tier and trivial to secure with RLS.
2. **The database is the source of truth for locking and visibility.** Kickoff-lock and hidden-until-lock are enforced by Postgres (RLS + trigger), not by app code. The app gets to be dumb; the DB cannot be lied to.
3. **Strings live in the repo (`next-intl` JSON), domain text lives in the DB.** UI chrome ships with the app; team names / prop questions / fixture metadata get `_en` / `_he` columns. Translating "Submit" through a DB join would be insane.

## Standard Architecture

### System Overview

```
                          ┌──────────────────────┐
                          │  Browser (RSC HTML + │
                          │   small RCC islands) │
                          └──────────┬───────────┘
                                     │  HTTPS
                                     ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       Vercel (Next.js 15 App Router)                 │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  middleware.ts                                               │   │
│  │  • locale detect (Accept-Language → cookie → /[locale]/...)  │   │
│  │  • session cookie refresh via @supabase/ssr                  │   │
│  └─────────────────────────────────────────────────────────────┘   │
│  ┌────────────────────┐  ┌────────────────────┐  ┌─────────────┐   │
│  │ /[locale]/         │  │ /[locale]/admin/   │  │ /[locale]/  │   │
│  │   (RSC pages)      │  │   (RSC + actions)  │  │   join      │   │
│  │  • leaderboard     │  │  • results entry   │  │  (invite UI)│   │
│  │  • predictions     │  │  • roster edit     │  └─────────────┘   │
│  │  • bracket / props │  │  • prop authoring  │                    │
│  └──────────┬─────────┘  └──────────┬─────────┘                    │
│             │ Server Actions / Server Components                    │
│             ▼                                                       │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  lib/db (server-only): typed Supabase queries + scoring     │   │
│  │  lib/auth (server-only): invite-code → anon-user binding    │   │
│  │  lib/i18n: next-intl config, locale negotiation             │   │
│  └─────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────┬──────────────────────────────────┘
                                   │ Postgres wire (RLS-enforced)
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Supabase (Postgres + Auth)                        │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  │
│  │ auth.users (anon)│  │ profiles         │  │ tournament       │  │
│  │  + custom claim  │──│ display_name,    │  │ + invite_code    │  │
│  │   pool_member    │  │ locale, role     │  │                  │  │
│  └──────────────────┘  └────────┬─────────┘  └──────────────────┘  │
│  ┌──────────────────┐  ┌────────┴─────────┐  ┌──────────────────┐  │
│  │ teams (name_en,  │  │ fixtures         │  │ prop_questions   │  │
│  │  name_he, flag)  │──│ kickoff_at (UTC) │  │ (locked_at)      │  │
│  └──────────────────┘  └────────┬─────────┘  └────────┬─────────┘  │
│  ┌──────────────────┐  ┌────────┴─────────┐  ┌────────┴─────────┐  │
│  │ bracket_slots    │  │ predictions      │  │ prop_answers     │  │
│  │ (R32→Champion)   │  │ (per fixture)    │  │ (per question)   │  │
│  └────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘  │
│  ┌────────┴─────────┐           │                     │             │
│  │ bracket_picks    │           │                     │             │
│  └──────────────────┘           ▼                     ▼             │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ results (admin-written) ──► triggers ──► score_events       │   │
│  │                                          (append-only audit) │   │
│  └─────────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  v_leaderboard (VIEW) — sums score_events per user, per mode │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| `middleware.ts` | Locale negotiation, Supabase session cookie refresh | Edge middleware, `@supabase/ssr` `createServerClient` |
| `app/[locale]/page.tsx` etc. | Server-render UI from Postgres | RSC, async, `cache: 'no-store'` for personal data |
| Server Actions (`'use server'`) | All writes (submit prediction, enter result, join pool) | Co-located with the page that triggers them |
| `lib/db/*.ts` | Typed query helpers; one file per aggregate (predictions, bracket, scoring) | Server-only, throws on misuse |
| `lib/auth/*.ts` | Translate invite-code submission → anonymous Supabase user + `profiles` row; expose `getCurrentMember()` | Server-only |
| `lib/i18n/*.ts` | `next-intl` request config; resolve locale from URL segment + cookie | Server-side, but `<NextIntlClientProvider>` for RCC subtrees |
| `lib/scoring/*.ts` | Pure functions: `scoreMatch(prediction, result)`, `scoreBracket(pick, slotResult)`, `scoreProp(...)`; called by DB trigger via PL/pgSQL **or** by Server Action after result entry | Pure TypeScript, plus a SQL mirror if you go the trigger route |
| Postgres RLS | Visibility (own vs others before/after kickoff) + locking (no write past kickoff) | `USING` and `WITH CHECK` clauses referencing `fixtures.kickoff_at` |
| `v_leaderboard` (DB view) | Aggregate `score_events` into per-user totals + per-mode breakdown | Plain SQL view; no materialization needed at 15 users |

## Recommended Project Structure

```
src/
├── app/
│   ├── [locale]/                          # i18n routing root
│   │   ├── layout.tsx                     # <html lang dir>, NextIntlProvider
│   │   ├── page.tsx                       # Leaderboard (server)
│   │   ├── predictions/
│   │   │   ├── page.tsx                   # List fixtures + per-fixture prediction (server)
│   │   │   └── [fixtureId]/
│   │   │       └── page.tsx               # Detail / reveal-after-lock (server)
│   │   ├── bracket/
│   │   │   └── page.tsx                   # Bracket UI (server shell + client form)
│   │   ├── props/
│   │   │   └── page.tsx                   # Prop questions (locks at tournament start)
│   │   ├── players/
│   │   │   └── [playerId]/page.tsx        # Per-player breakdown
│   │   ├── join/
│   │   │   └── page.tsx                   # Invite-code + display-name form
│   │   └── admin/
│   │       ├── layout.tsx                 # role gate
│   │       ├── results/page.tsx           # Enter / correct match results
│   │       ├── fixtures/page.tsx          # Pre-seed + tweak schedule
│   │       ├── props/page.tsx             # Author + grade prop questions
│   │       └── roster/page.tsx            # Edit display names, remove users
│   ├── api/                               # Only if forced (webhooks, cron). Prefer Server Actions.
│   └── globals.css                        # Tailwind + RTL/LTR base
├── components/
│   ├── ui/                                # Buttons, inputs, Toast — purely presentational
│   ├── layout/                            # Header, LocaleToggle, NavBar
│   ├── game-modes/
│   │   ├── league/                        # FixtureCard, ScoreInput, RevealedPrediction
│   │   ├── bracket/                       # SlotPicker, BracketTree
│   │   └── props/                         # PropForm, PropResult
│   ├── leaderboard/                       # LeaderboardTable, PerModeBreakdown
│   └── admin/                             # ResultEntryForm, FixtureEditor
├── lib/
│   ├── supabase/
│   │   ├── server.ts                      # createServerClient (RSC + Server Actions)
│   │   ├── client.ts                      # createBrowserClient (RCC islands only)
│   │   └── middleware.ts                  # Session refresh helper
│   ├── auth/
│   │   ├── invite.ts                      # validate code, bind anon user, write profile
│   │   └── session.ts                     # getCurrentMember(), requireMember(), requireAdmin()
│   ├── db/
│   │   ├── fixtures.ts
│   │   ├── predictions.ts
│   │   ├── bracket.ts
│   │   ├── props.ts
│   │   ├── results.ts
│   │   └── leaderboard.ts
│   ├── scoring/
│   │   ├── match.ts                       # 4/3/2 logic
│   │   ├── bracket.ts                     # 2/4/8/16/32 logic
│   │   └── props.ts
│   ├── i18n/
│   │   ├── config.ts                      # locales: ['he', 'en'], defaultLocale: 'he'
│   │   ├── request.ts                     # next-intl getRequestConfig
│   │   └── routing.ts                     # Locale-aware <Link>
│   └── time/
│       └── lock.ts                        # isLocked(fixture, nowOverride?) — single source of truth
├── messages/
│   ├── en.json                            # next-intl UI strings
│   └── he.json
├── types/
│   └── db.ts                              # Generated by `supabase gen types typescript`
├── middleware.ts                          # Locale + Supabase session refresh
└── supabase/
    ├── migrations/                        # SQL migrations checked into git
    │   ├── 0001_init.sql
    │   ├── 0002_rls.sql
    │   ├── 0003_seed_wc2026.sql
    │   └── 0004_scoring_triggers.sql
    └── seed.sql                           # Optional dev seed
```

### Structure Rationale

- **`app/[locale]/`** — locale is a URL segment so RTL/LTR is decided in `layout.tsx` from a single source. Cookies are still used for sticky preference but the URL wins for shareability and SSR cache keys.
- **`components/game-modes/{league,bracket,props}`** — the three modes have genuinely different data shapes (score tuple vs. team-ID slot vs. free-form answer). Keeping their UI siblings prevents bracket UI from leaking into match UI.
- **`lib/db/`** is the only place that talks to Supabase. Pages call `lib/db`, never the client directly. This is the seam where you can swap to a mock for tests if it ever matters.
- **`lib/scoring/`** is pure functions. The same logic gets mirrored as a Postgres trigger (`0004_scoring_triggers.sql`) so the DB can rescore on result-correction without round-tripping through the app.
- **`lib/time/lock.ts`** — single `isLocked()` predicate used by UI, Server Actions, and (mirrored) by the SQL constraint. If you ever need to fudge time for testing, change one place.
- **`supabase/migrations/`** is checked into git. The schema is part of the project, not a thing that lives in the Supabase dashboard.

## Schema Sketch

> Postgres dialect, Supabase conventions. All `id` columns are `uuid default gen_random_uuid()` unless noted. Timestamps are `timestamptz` and stored UTC.

```sql
-- ─── Identity ────────────────────────────────────────────────────────────
-- We piggyback on Supabase anonymous auth: signInAnonymously() creates an
-- auth.users row with is_anonymous=true. We then require an invite-code
-- exchange (server action) before writing a profile, which is what RLS
-- actually keys on. "No profile = no access" is the gate.

create table tournament (
  id           uuid primary key,
  slug         text unique not null,       -- 'wc2026'
  name_en      text not null,
  name_he      text not null,
  starts_at    timestamptz not null,       -- 2026-06-11T...
  invite_code  text not null,              -- hashed; compared in a server action
  props_lock_at timestamptz not null       -- usually = starts_at
);

create table profiles (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  tournament_id uuid not null references tournament(id),
  display_name text not null,
  locale       text not null default 'he' check (locale in ('he','en')),
  role         text not null default 'member' check (role in ('member','admin')),
  created_at   timestamptz not null default now()
);
create unique index on profiles (tournament_id, lower(display_name));

-- ─── Tournament structure ────────────────────────────────────────────────
create table teams (
  id           uuid primary key,
  tournament_id uuid not null references tournament(id),
  code         text not null,              -- 'MEX', 'RSA' (used for placeholders)
  name_en      text not null,
  name_he      text not null,
  flag_emoji   text,                       -- cheap visual; SVGs are overkill
  group_code   text                        -- 'A'..'L' for the 12 WC26 groups
);
create unique index on teams (tournament_id, code);

create table fixtures (
  id            uuid primary key,
  tournament_id uuid not null references tournament(id),
  stage         text not null check (stage in
                  ('group','r32','r16','qf','sf','final','third_place')),
  -- Either a concrete team is set, OR a placeholder describes how to fill it.
  -- After admin enters results, placeholders are resolved into team_*_id.
  home_team_id  uuid references teams(id),
  away_team_id  uuid references teams(id),
  home_placeholder text,                   -- e.g. 'WINNER_GROUP_A', 'R32_M1_W'
  away_placeholder text,
  kickoff_at    timestamptz not null,
  venue         text,
  match_number  int not null,              -- 1..104, FIFA's official numbering
  unique (tournament_id, match_number)
);
create index on fixtures (kickoff_at);

-- ─── Results (admin writes; triggers do the rest) ────────────────────────
create table results (
  fixture_id    uuid primary key references fixtures(id) on delete cascade,
  home_score    int not null check (home_score >= 0),
  away_score    int not null check (away_score >= 0),
  -- For knockouts only: who advanced (handles PK/extra-time without modeling them)
  winner_team_id uuid references teams(id),
  recorded_at   timestamptz not null default now(),
  recorded_by   uuid not null references profiles(user_id)
);

-- ─── League Mode ─────────────────────────────────────────────────────────
create table predictions (
  user_id       uuid not null references profiles(user_id) on delete cascade,
  fixture_id    uuid not null references fixtures(id) on delete cascade,
  home_score    int not null check (home_score >= 0),
  away_score    int not null check (away_score >= 0),
  submitted_at  timestamptz not null default now(),
  primary key (user_id, fixture_id)
);

-- ─── Bracket Mode ────────────────────────────────────────────────────────
-- One row per (user, slot). Slots are pre-defined: 'R32_M1'..'R32_M16',
-- 'R16_M1'..'R16_M8', ..., 'FINAL', 'CHAMPION'. The fixture they map to
-- can be NULL early on (because R16 fixtures only get teams after R32).
create table bracket_slots (
  id            uuid primary key,
  tournament_id uuid not null references tournament(id),
  slot_code     text not null,             -- 'R32_M1', 'CHAMPION', etc.
  stage         text not null,             -- mirrors fixtures.stage; 'champion' too
  fixture_id    uuid references fixtures(id),  -- nullable for CHAMPION
  unique (tournament_id, slot_code)
);

create table bracket_picks (
  user_id       uuid not null references profiles(user_id) on delete cascade,
  slot_id       uuid not null references bracket_slots(id) on delete cascade,
  team_id       uuid not null references teams(id),
  submitted_at  timestamptz not null default now(),
  primary key (user_id, slot_id)
);

-- ─── Props (tournament-level) ────────────────────────────────────────────
create table prop_questions (
  id            uuid primary key,
  tournament_id uuid not null references tournament(id),
  prompt_en     text not null,
  prompt_he     text not null,
  answer_type   text not null check (answer_type in ('team','text','integer')),
  points        int not null default 5,
  correct_team_id uuid references teams(id),    -- when answer_type='team'
  correct_text  text,                            -- when answer_type='text' or 'integer'
  graded_at     timestamptz
);

create table prop_answers (
  user_id       uuid not null references profiles(user_id) on delete cascade,
  question_id   uuid not null references prop_questions(id) on delete cascade,
  team_id       uuid references teams(id),
  answer_text   text,
  submitted_at  timestamptz not null default now(),
  primary key (user_id, question_id),
  check (
    (team_id is not null and answer_text is null) or
    (team_id is null and answer_text is not null)
  )
);

-- ─── Scoring (append-only audit; view aggregates) ────────────────────────
create table score_events (
  id            bigserial primary key,
  user_id       uuid not null references profiles(user_id) on delete cascade,
  source        text not null check (source in ('match','bracket','prop')),
  ref_id        uuid not null,             -- fixture_id, slot_id, or question_id
  points        int not null,
  computed_at   timestamptz not null default now(),
  unique (user_id, source, ref_id)         -- recompute = upsert, not duplicate
);

create view v_leaderboard as
  select
    p.user_id,
    p.display_name,
    coalesce(sum(case when s.source='match' then s.points end), 0)   as match_points,
    coalesce(sum(case when s.source='bracket' then s.points end), 0) as bracket_points,
    coalesce(sum(case when s.source='prop' then s.points end), 0)    as prop_points,
    coalesce(sum(s.points), 0) as total_points
  from profiles p
  left join score_events s on s.user_id = p.user_id
  group by p.user_id, p.display_name;
```

### Why this shape

- **`profiles` is the membership table.** RLS keys on `profiles`, not `auth.users` directly — so "anonymous user without a profile" gets zero rows back. This is the invite gate.
- **`fixtures.{home,away}_placeholder`** solves tournament reseeding (group winner → R32 slot) declaratively. When the admin enters a group's final results, a server action (or trigger) resolves placeholders by mutating `home_team_id`/`away_team_id` on the dependent fixture. Predictions reference `fixture_id`, not team — so a user predicting "R32 Match 1: 2-1" still has a valid prediction even if they bet before teams were set.
- **`bracket_picks` keyed on slot, not fixture.** A user picks "who wins R16 Match 3" — they're betting on a *team* advancing through a *slot*, independent of which fixture eventually fills that slot. Scoring at the bracket level only needs `slot.stage` and whether `team_id` matches the actual advancer.
- **`score_events` as upsert audit.** Result corrections re-trigger scoring; the unique key on `(user_id, source, ref_id)` makes recomputation idempotent. No "did we already score this?" book-keeping.
- **`v_leaderboard` is a plain view.** At 15 users this returns in single-digit milliseconds. Materializing buys you nothing.

## Architectural Patterns

### Pattern 1: Postgres-Enforced Lock via RLS `WITH CHECK`

**What:** Kickoff-time locking lives in the database. Write attempts past kickoff fail at the row-level security layer; the app never needs to "remember" to check.

**When to use:** Always, for predictions and bracket_picks. Props use `tournament.props_lock_at` instead of a per-row kickoff.

**Trade-offs:**
- Pro: Cannot be bypassed by a buggy client, a forgotten `if` in a Server Action, or a curious user with `psql`.
- Pro: Edits, deletes, and inserts are all covered by the same expression (PostgreSQL evaluates `WITH CHECK` on INSERT/UPDATE; `USING` covers UPDATE/DELETE target rows).
- Con: `now()` in RLS is the server's clock, not the user's — but the server is the only clock that matters, which solves clock-skew by definition.

**Example:**
```sql
alter table predictions enable row level security;

-- Read: you can see your own predictions always; anyone's predictions after kickoff.
create policy predictions_read on predictions
  for select using (
    user_id = auth.uid()
    or exists (
      select 1 from fixtures f
      where f.id = predictions.fixture_id and f.kickoff_at <= now()
    )
  );

-- Write: must be your row, and the fixture must not have started yet.
create policy predictions_write on predictions
  for insert with check (
    user_id = auth.uid()
    and exists (select 1 from fixtures f
                where f.id = fixture_id and f.kickoff_at > now())
  );

create policy predictions_update on predictions
  for update
    using (user_id = auth.uid())
    with check (
      user_id = auth.uid()
      and exists (select 1 from fixtures f
                  where f.id = fixture_id and f.kickoff_at > now())
    );

create policy predictions_delete on predictions
  for delete using (
    user_id = auth.uid()
    and exists (select 1 from fixtures f
                where f.id = fixture_id and f.kickoff_at > now())
  );
```

Mirror the predicate in `lib/time/lock.ts` for UI ("you can no longer edit"), but treat the DB as the only enforcer.

### Pattern 2: Hidden-Until-Lock via RLS `USING`

**What:** The same RLS read policy that hides your row from others also reveals everyone's row once `kickoff_at <= now()`. No "private vs public" table split, no client-side filtering.

**When to use:** Any prediction artifact that should be secret until a moment passes (predictions, bracket_picks, prop_answers).

**Trade-offs:**
- Pro: One source of truth. The reveal happens server-side, on the row.
- Pro: Prediction-entry form (server component) calls the same query as the reveal page — RLS just returns more rows after kickoff.
- Con: A user reading the page during kickoff might get half-revealed rows; acceptable because kickoff is a single instant and the page refreshes anyway.

**Example:**
The `predictions_read` policy above already does this. For `bracket_picks`, the gate is "after first knockout match starts" (or per-slot, if you want strict-by-stage). For `prop_answers`, gate on `tournament.props_lock_at`.

```sql
create policy prop_answers_read on prop_answers
  for select using (
    user_id = auth.uid()
    or exists (
      select 1 from prop_questions q
        join tournament t on t.id = q.tournament_id
      where q.id = prop_answers.question_id
        and t.props_lock_at <= now()
    )
  );
```

### Pattern 3: Server-First with Selective Client Islands

**What:** Pages are RSC (`async function Page()`); writes go through Server Actions; only the things that need user state in the browser are Client Components.

**When to use:**
- **Server Component:** leaderboard, predictions list, bracket display, players/[id], all admin reads.
- **Client Component:** `<LocaleToggle>`, the live form inputs in `<ScoreInputs>` (so a user can type "2-1" without round-tripping), the bracket slot pickers, and a tiny `<RevalidateOnFocus>` wrapper that calls `router.refresh()` on tab focus for leaderboard freshness.
- **Server Action:** every write — `submitPrediction`, `submitBracketPick`, `submitPropAnswer`, `recordResult`, `joinPool`.

**Trade-offs:**
- Pro: Smallest client JS bundle; cheapest on free-tier; RLS gives you defense in depth.
- Pro: `revalidatePath('/[locale]')` after a result entry pushes new leaderboard data without a websocket.
- Con: A purely server-rendered prediction list won't update if another user predicts at the same moment — fine for 15 users; refresh-on-focus closes the gap.

**Example:**
```tsx
// app/[locale]/predictions/page.tsx (Server Component)
import { getFixturesWithUserPredictions } from '@/lib/db/predictions';
import { FixtureRow } from '@/components/game-modes/league/FixtureRow';

export default async function PredictionsPage() {
  const rows = await getFixturesWithUserPredictions(); // RLS scopes to current user
  return rows.map(r => <FixtureRow key={r.fixture.id} {...r} />);
}

// FixtureRow.tsx — server shell, client inputs inside
import { ScoreInputs } from './ScoreInputs.client';
import { submitPrediction } from '@/lib/db/predictions';

export function FixtureRow({ fixture, prediction }) {
  return (
    <form action={submitPrediction}>
      <input type="hidden" name="fixtureId" value={fixture.id} />
      <ScoreInputs defaultHome={prediction?.home_score} defaultAway={prediction?.away_score} />
      <button type="submit">{/* t('save') */}</button>
    </form>
  );
}
```

### Pattern 4: Bilingual Content Split (Repo vs DB)

**What:** UI strings (button labels, error messages, page headers) live in `messages/{en,he}.json` consumed by `next-intl`. Domain text (team names, prop questions) lives in DB columns suffixed `_en` / `_he`, selected per request based on the resolved locale.

**When to use:**
- **Repo (`next-intl`):** anything a developer would write in code — "Submit prediction", "Locked", date formatters, plurals.
- **DB columns:** anything the admin (or you, during seed) types — team names, prop question text.

**Trade-offs:**
- Pro: Devs ship strings with code, atomically. Admin doesn't need code access to add a new prop question.
- Pro: Avoids a "translations" table with joins on every team name lookup.
- Con: Adding a third language later means adding columns. Fine — we have two, that's the spec.

**Implementation details:**
- `lib/i18n/config.ts`: `locales = ['he', 'en']`, `defaultLocale = 'he'` (per Key Decision in PROJECT.md), `localeDetection = true`.
- Locale persistence: URL segment is canonical (`/he/...`, `/en/...`); cookie (`NEXT_LOCALE`) preserves toggle across visits; `profiles.locale` is the source of truth for logged-in users and overrides the cookie. On login, set the cookie from `profiles.locale`.
- `app/[locale]/layout.tsx` sets `<html lang={locale} dir={locale === 'he' ? 'rtl' : 'ltr'}>`.
- **RTL approach:** Tailwind logical properties (`ms-2`, `me-2`, `ps-4`, `pe-4`, `start-0`, `end-0`) — these are first-class in Tailwind v3.3+ and reverse automatically based on `dir`. **Do not** install `tailwindcss-rtl`; logical properties are the modern answer.
- For the rare LTR-locked element (a score input `2-1` reads LTR even in Hebrew), wrap in `<span dir="ltr">`.

### Pattern 5: Idempotent Scoring on Result Mutation

**What:** A trigger on `results` (insert or update) recomputes affected `score_events` rows by upsert. Correcting a result automatically re-grades.

**When to use:** Both for match predictions (per fixture) and bracket picks (per slot, when a knockout result resolves a slot). Props grade explicitly when the admin marks them.

**Trade-offs:**
- Pro: "Admin enters wrong result, corrects it" is a single UPDATE; the system reconciles itself.
- Pro: `score_events` unique constraint means no double-counting.
- Con: The scoring function lives in PL/pgSQL *and* in TypeScript (for testability and use in the Server Action that grades props). Keep both extremely small.

**Example:**
```sql
create or replace function score_fixture(p_fixture_id uuid) returns void
language plpgsql as $$
declare r record; p record; pts int;
begin
  select * into r from results where fixture_id = p_fixture_id;
  if not found then return; end if;

  for p in select * from predictions where fixture_id = p_fixture_id loop
    pts := case
      when p.home_score = r.home_score and p.away_score = r.away_score then 4
      when (p.home_score - p.away_score) = (r.home_score - r.away_score)
        and sign(p.home_score - p.away_score) <> 0 then 3
      when sign(p.home_score - p.away_score) = sign(r.home_score - r.away_score) then 2
      else 0
    end;
    insert into score_events (user_id, source, ref_id, points)
      values (p.user_id, 'match', p_fixture_id, pts)
      on conflict (user_id, source, ref_id) do update set points = excluded.points,
                                                         computed_at = now();
  end loop;
end $$;

create or replace function on_results_change() returns trigger language plpgsql as $$
begin
  perform score_fixture(new.fixture_id);
  -- Also: if this fixture resolves a knockout slot, perform score_bracket_slot(...)
  return new;
end $$;

create trigger trg_results_score
  after insert or update on results
  for each row execute function on_results_change();
```

## Data Flow

### Request Flow — Submit a Prediction

```
User clicks "Save" on FixtureRow
    ↓
Server Action submitPrediction(formData)
    ↓
  validate (zod) → require auth.uid() via getUser()
    ↓
  upsert into predictions (...) values (...)
    ↓
  RLS WITH CHECK evaluates fixtures.kickoff_at > now()
    ↓ (fails → throw user-facing "Match already started")
    ↓ (passes)
  revalidatePath('/[locale]/predictions')
    ↓
Server re-renders the page; FixtureRow shows the new value
```

### Request Flow — Admin Enters Result

```
Admin submits ResultEntryForm in /admin/results
    ↓
Server Action recordResult({fixtureId, home, away, winnerId?})
    ↓
  requireAdmin()  (role check on profiles)
    ↓
  upsert into results
    ↓
  trigger trg_results_score → score_fixture() + maybe score_bracket_slot()
    ↓
  if knockout: resolve placeholder on next-stage fixture (home_team_id / away_team_id)
    ↓
  revalidatePath('/[locale]')           -- leaderboard
  revalidatePath('/[locale]/players')
    ↓
Family refreshes; leaderboard moves
```

### State Management

There is no client-side state store. Per-request RSC is the state model.

```
Postgres (truth)
   ↓ RSC fetch on every request (no client cache)
Page JSX
   ↓ revalidatePath on writes / router.refresh() on focus
Re-fetch → re-render
```

The only "state" the client owns is form inputs (controlled by React inside `*.client.tsx` components) and the locale cookie.

### Key Data Flows

1. **Join the pool:** anon-signin → submit invite code → server action validates against `tournament.invite_code` → insert `profiles` row → set locale from browser preference → redirect to `/[locale]/predictions`.
2. **Predict:** RSC loads fixtures (RLS scoped) → user types into client `<ScoreInputs>` → form submits to Server Action → DB write or RLS rejection.
3. **Reveal:** at `kickoff_at`, `predictions_read` policy widens; next RSC render shows everyone's prediction for that fixture. Browser doesn't need notification — page refresh (manual, navigation, or focus) does it.
4. **Score:** admin write → trigger → `score_events` upsert → `v_leaderboard` recomputes on next select → `revalidatePath` invalidates page cache → next render is fresh.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-15 users (target) | Exactly what's described. RSC + RLS + view. No caching layer needed. |
| 15-1k users | Add `materialized view` for leaderboard, refreshed in the same trigger. Add `pg_cron` for "lock-at-kickoff" notifications if anyone asks. Still no Redis. |
| 1k-100k users | Move leaderboard to a denormalized `user_totals` table updated by trigger; add Cloudflare/Vercel edge caching for public pages. Add Supabase Realtime channel for the leaderboard page if WC fervor demands it. |

### Scaling Priorities

1. **First bottleneck:** the leaderboard select during the opening match if everyone refreshes. At 15 users, irrelevant. Mitigation if needed: `revalidate = 30` (ISR) on the leaderboard page.
2. **Second bottleneck:** RLS join-cost on `predictions_read` (joins `fixtures` per row). Index `fixtures(kickoff_at)` is already proposed; at higher scale, denormalize `kickoff_at` onto `predictions` and key the RLS off the local column.

## Anti-Patterns

### Anti-Pattern 1: Enforcing Lock Only in the Server Action

**What people do:** `if (fixture.kickoff_at <= new Date()) throw new Error('locked')` in the Server Action, no DB constraint.
**Why it's wrong:** A forgotten check, a SQL Editor session, or any future code path bypasses it. Visibility (RLS) and writability (RLS) end up out of sync.
**Do this instead:** RLS `WITH CHECK` is the only enforcer. App code only mirrors the predicate for UI affordance.

### Anti-Pattern 2: A "Public Predictions" Table Separate from Private

**What people do:** Insert into `predictions_private`, then a trigger copies into `predictions_public` at kickoff.
**Why it's wrong:** Doubles storage, adds a scheduler dependency (when does the copy fire?), and produces a second source of truth.
**Do this instead:** One `predictions` table, one `USING` clause that widens at `now() >= kickoff_at`. The same row is private then public — by viewer, not by storage.

### Anti-Pattern 3: Translating Team Names Through a `translations` Join Table

**What people do:** `translations(table_name, row_id, locale, value)` joined into every team query.
**Why it's wrong:** Every read becomes a join. Type safety vanishes. The benefit (add languages later) is irrelevant when the spec has exactly two locales.
**Do this instead:** `name_en` and `name_he` columns. Select `case when locale='he' then name_he else name_en end as name`. Done.

### Anti-Pattern 4: Forcing Supabase Auth to Match Invite-Code Semantics

**What people do:** Generate fake emails like `displayname@invite.local` and use `signUp({ email, password })` so they can "use Supabase Auth properly."
**Why it's wrong:** Pollutes `auth.users` with bogus emails, creates a confirmation-flow trap, and still doesn't enforce the invite gate.
**Do this instead:** Use `supabase.auth.signInAnonymously()` (per [Supabase anonymous sign-ins docs](https://supabase.com/docs/guides/auth/auth-anonymous)). The "invite code" is a server-action gate that, on success, creates a `profiles` row binding the anon `auth.users.id` to a `tournament_id` and display name. RLS keys on the existence of that profile row, not on the auth user.

### Anti-Pattern 5: Supabase Realtime for a 15-User Leaderboard

**What people do:** Subscribe each browser to `score_events` changes via WebSocket.
**Why it's wrong:** Adds JS bundle weight, free-tier connection accounting, and a moving part. For 15 users who refresh after a match anyway, you get the same UX from `revalidatePath` + `router.refresh()` on focus.
**Do this instead:** Polling-by-default. Add Realtime only if a user complains. (See [Supabase realtime with Next.js](https://supabase.com/docs/guides/realtime/realtime-with-nextjs) — it's available, but not needed at this scale.)

### Anti-Pattern 6: Tailwind `tailwindcss-rtl` Plugin

**What people do:** Install a plugin that adds `rtl:` variants.
**Why it's wrong:** Tailwind has had logical properties (`ms-*`, `me-*`, `ps-*`, `pe-*`) built in since v3.3. Logical properties handle RTL via the parent `dir` attribute — no plugin, no variant prefix, less to remember.
**Do this instead:** Set `<html dir="rtl">` for Hebrew (in `app/[locale]/layout.tsx`). Use `ms-` / `me-` instead of `ml-` / `mr-`. The CSS itself flips.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Supabase Postgres | `@supabase/ssr` `createServerClient` in RSC + Server Actions; `createBrowserClient` in client islands only | Cookies handled by middleware; pass `cookies()` from `next/headers` |
| Supabase Auth | Anonymous sign-in + custom invite gate; no email/password | `auth.users.is_anonymous = true` is normal here |
| Vercel | Deploy via git push; configure `SUPABASE_URL` + `SUPABASE_ANON_KEY` + `SUPABASE_SERVICE_ROLE_KEY` (server-only) | Use Vercel env vars; never inline service role key |
| (no external sports API) | Admin enters results manually | Explicit out-of-scope per PROJECT.md |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| RSC page → `lib/db` | Function call, async | Pages never import `@supabase/supabase-js` directly |
| Server Action → `lib/db` | Function call, async | Server Actions are thin: parse → call db → revalidate |
| `lib/db` → Postgres | `@supabase/ssr` server client; RLS-scoped to current user | Service role key only used by admin server actions; gate with `requireAdmin()` |
| `lib/scoring` ↔ Postgres trigger | Same algorithm in two languages | If diverged, the DB wins (it's the one that runs on result-change). TS version is for the prop-grade server action + tests. |
| Client island → Server Action | `<form action={...}>` or `useTransition` | No fetch() round-trips |
| `messages/*.json` → components | `useTranslations()` (client) / `getTranslations()` (server) from `next-intl` | Both available; pick by component type |

## Build Order / Dependencies

Three-week timeline. Solo dev. The graph is shallow but the ordering matters because RLS-and-locking is the project's beating heart.

**Week 1 — Foundations (everything else depends on these)**
1. **Repo + Next.js 15 + Tailwind + next-intl skeleton.** Two pages, two locales, RTL working. (Blocks: everything UI.)
2. **Supabase project + schema migrations 0001 (tables) + 0002 (RLS skeleton — read own only, no time logic yet).** (Blocks: any persistence.)
3. **Invite-code → anonymous-auth → profile flow.** End-to-end: visit `/join`, submit code, get a profile, redirect to `/predictions`. (Blocks: every authenticated screen.)
4. **WC 2026 seed.** Migration 0003: insert 48 teams + 104 fixtures with placeholders + 12 group codes. (Blocks: league mode, bracket mode.)

**Week 2 — Game modes (the three can be parallelized after Week 1 is solid)**
5. **League Mode end-to-end:** list fixtures (server), prediction form (server + client inputs), submit Server Action, RLS lock + reveal policies (migration 0002 finalized). **This is the riskiest path — do first.**
6. **Bracket Mode:** `bracket_slots` seeded, slot picker UI (client), submit action, reveal policy. Can start in parallel with #5 once schema is settled.
7. **Props Mode:** prop_questions admin authoring, prop_answers form, grade flow. Smaller surface; can be last.
8. **Admin Results Entry + Scoring Triggers (migration 0004):** result form, trigger fires, score_events populated, placeholder-resolution logic. **Test with real WC fixtures sequenced in time.**

**Week 3 — Leaderboard + polish + deploy**
9. **Leaderboard view + per-player breakdown page.** Smallest code, biggest value. (Blocks: shipping.)
10. **Locale toggle component + locale persistence (profiles.locale + cookie sync).**
11. **Admin roster page + fixture editor (for the inevitable schedule fixes).**
12. **End-to-end test with 2-3 fake users + real fixtures + advance the clock locally.**
13. **Deploy to Vercel; preview link to family; iterate on UI feedback.**

**Critical path:** 1 → 2 → 3 → 4 → 5 → 8 → 9 → 13. Everything else is parallelizable around it.

**What's safe to defer past June 11 if time runs short:** props mode entirely (props lock at tournament start anyway; if it ships day 2 nobody cares); per-player breakdown (a click-through; leaderboard alone is the core value); fixture editor in admin (you seeded it correctly, you can SQL-edit if something changes).

## Edge Cases

### Tournament reseeding (Group A winner → R32 slot)

`fixtures.{home,away}_placeholder` carries the symbolic reference (`'WINNER_GROUP_A'`, `'R32_M1_W'`). When the admin enters the last group-stage result for Group A, a server action (or trigger):
1. Computes group standings from `results` for that group.
2. Updates `fixtures.home_team_id` (or `away_team_id`) on any fixture whose placeholder names this group's winner/runner-up/third-place.
3. Triggers any pending bracket_slot scoring (none yet, until knockouts begin).

Predictions made before placeholder resolution remain valid — they reference `fixture_id`. Bracket picks are unaffected because they reference slots and teams, not fixtures.

The "8 best third-placed teams" rule (unique to WC26's 48-team format) is computed in one server action over all twelve groups after the last group match finishes. Until then, the eight third-placed R32 slot placeholders stay symbolic (`'THIRD_PLACE_1'`..`'THIRD_PLACE_8'`).

### Admin enters wrong result, corrects it

`results` is a one-row-per-fixture table; correction is an UPDATE. The `trg_results_score` trigger fires on UPDATE, calls `score_fixture()`, which upserts `score_events` for every prediction on that fixture. Old points are overwritten; the leaderboard view recomputes on next select.

If the correction changes the winner of a knockout match, the trigger also re-resolves placeholders downstream and rescores affected bracket slots. (This is the gnarliest cascade — write a regression test.)

### User joins mid-tournament

Anonymous sign-in + invite-code exchange creates a profile any time. RLS policies don't gate on join-time. The user can submit predictions for any fixture whose `kickoff_at > now()` — i.e., they're locked out of past matches automatically by the same policy that locks current users. No special-case code. They start with zero points; the leaderboard puts them at the bottom; nobody is confused.

**Optional UX choice:** show a small "joined late — locked matches you missed: 27" label on their profile. Cosmetic only.

### Clock skew

The DB clock is the only clock. The UI shows "locks in 3 minutes" based on the client clock but submits to a Server Action whose `now()` is the DB's. If the client is 30 seconds slow, the user sees a tick saying "lock in 0:00" and gets a "match already started" error from the server — acceptable and self-correcting. Display the server time in the page header (rendered SSR) if you want to be polite.

### Two users predict the same fixture at the same moment

Each `INSERT ... ON CONFLICT (user_id, fixture_id) DO UPDATE` is per-user. No contention. The unique primary key handles concurrent edits by the *same* user (last write wins) which is the intended semantics for a prediction form.

### Daylight saving / timezone display

`kickoff_at` is `timestamptz` UTC. Render in the user's locale via `Intl.DateTimeFormat`, which `next-intl`'s `useFormatter()` wraps. Pass a `timeZone` hint if you want everyone to see kickoff in venue-local time; otherwise browser tz is fine.

## Sources

- [Next.js App Router internationalization with next-intl](https://next-intl.dev/docs/getting-started/app-router) — locale routing, RSC integration (HIGH confidence)
- [Setup locale-based routing — next-intl](https://next-intl.dev/docs/getting-started/app-router/with-i18n-routing) (HIGH)
- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security) — USING vs WITH CHECK semantics (HIGH)
- [Supabase RLS Simplified — USING vs WITH CHECK](https://www.rajeshdhiman.in/blog/supabase-rls-simplified-using-vs-with-check) (MEDIUM, corroborates official docs)
- [Supabase RLS performance and best practices](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv) — initPlan caching, simple policies (HIGH)
- [Supabase Anonymous Sign-Ins](https://supabase.com/docs/guides/auth/auth-anonymous) — primitive for invite-code-only identity (HIGH)
- [Setting up Server-Side Auth for Next.js — @supabase/ssr](https://supabase.com/docs/guides/auth/server-side/nextjs) (HIGH)
- [Using Realtime with Next.js](https://supabase.com/docs/guides/realtime/realtime-with-nextjs) — referenced to justify *not* using it (HIGH)
- [Designing a Sports Tournament Data Model for PostgreSQL](https://www.datensen.com/blog/data-model/designing-a-sports-tournament-data-model/) — schema patterns for matches + teams (MEDIUM)
- [2026 FIFA World Cup format — Wikipedia](https://en.wikipedia.org/wiki/2026_FIFA_World_Cup) — 48 teams, 12 groups, 104 matches, R32 stage (HIGH)
- [How to support RTL languages in Next.js](https://lingo.dev/en/nextjs-pages-router-i18n/right-to-left-languages) — `dir` attribute + logical properties (MEDIUM)

---
*Architecture research for: bilingual prediction-pool web app, WC 2026*
*Researched: 2026-05-23*
