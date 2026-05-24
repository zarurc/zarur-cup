-- Migration 0001: Phase 1 schema for Zarur-Cup.
-- All timestamps are `timestamptz`. All FKs ON DELETE behavior is explicit.
-- RLS is NOT enabled here -- see 0002_rls.sql.

-- ============================================================
-- 1. Tournament (single row for WC 2026)
-- ============================================================
create table public.tournament (
  id          uuid primary key default gen_random_uuid(),
  code        text unique not null,           -- e.g. 'WC2026'
  name_en     text not null,
  name_he     text not null,
  starts_at   timestamptz not null,           -- first kickoff (June 11, 2026 UTC)
  ends_at     timestamptz not null,           -- final + buffer
  created_at  timestamptz not null default now()
);

-- ============================================================
-- 2. Profiles (keyed on Supabase auth.users.id; D-04, D-07..D-10, D-11)
-- ============================================================
create table public.profiles (
  user_id                   uuid primary key references auth.users(id) on delete cascade,
  display_name              text not null check (char_length(display_name) between 2 and 24),
  display_name_normalized   text generated always as
                              (lower(trim(normalize(display_name, NFC)))) stored,
  locale                    text not null default 'he' check (locale in ('he','en')),
  is_admin                  boolean not null default false,
  joined_at                 timestamptz not null default now()
);
create unique index profiles_display_name_normalized_uniq
  on public.profiles (display_name_normalized);

-- ============================================================
-- 3. Teams (48 WC 2026 teams; bilingual; group letter; D-22, DATA-01)
-- ============================================================
create table public.teams (
  id              uuid primary key default gen_random_uuid(),
  tournament_id   uuid not null references public.tournament(id) on delete cascade,
  code            text not null,                 -- ISO-3 country code, e.g. 'ARG'
  name_en         text not null,
  name_he         text not null,
  group_code      char(1),                       -- 'A'..'L' for WC 2026 (12 groups), NULL pre-draw
  created_at      timestamptz not null default now(),
  unique (tournament_id, code)
);

-- ============================================================
-- 4. Fixtures (104 matches with UTC kickoff + symbolic placeholders; D-22, DATA-02)
-- ============================================================
create table public.fixtures (
  id                   uuid primary key default gen_random_uuid(),
  tournament_id        uuid not null references public.tournament(id) on delete cascade,
  external_match_no    int not null,             -- FIFA's 1..104 match number
  stage                text not null check (stage in (
                          'group','round_of_32','round_of_16',
                          'quarter_final','semi_final','third_place','final'
                       )),
  group_code           char(1),                  -- 'A'..'L' for group-stage; NULL for KO
  home_team_id         uuid references public.teams(id) on delete restrict,  -- NULL until placeholder resolves
  away_team_id         uuid references public.teams(id) on delete restrict,
  home_placeholder     text,                     -- e.g. 'WINNER_GROUP_A', 'R32_M1_W', NULL once resolved
  away_placeholder     text,
  kickoff_at           timestamptz not null,     -- ALWAYS UTC; verify with grep on the seed
  venue_code           text,                     -- city code, optional
  result_home          smallint,                 -- 90-min final score (Phase 2 admin enters)
  result_away          smallint,
  result_home_90min    smallint,                 -- for KO extra-time (Phase 2)
  result_away_90min    smallint,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (tournament_id, external_match_no),
  check ((home_team_id is not null) or (home_placeholder is not null)),
  check ((away_team_id is not null) or (away_placeholder is not null))
);
create index fixtures_kickoff_idx       on public.fixtures (kickoff_at);
create index fixtures_stage_idx         on public.fixtures (stage);
create index fixtures_tournament_idx    on public.fixtures (tournament_id);

-- ============================================================
-- 5. Bracket slots (R32 -> Champion; D-22, DATA-03; one-table approach per RESEARCH §"Open Questions")
-- ============================================================
create table public.bracket_slots (
  id              uuid primary key default gen_random_uuid(),
  tournament_id   uuid not null references public.tournament(id) on delete cascade,
  slot_code       text not null,           -- e.g. 'R32_M1', 'R16_M1', 'QF_M1', 'SF_M1', 'F', 'CHAMPION'
  stage           text not null check (stage in (
                     'round_of_32','round_of_16','quarter_final','semi_final','final','champion'
                  )),
  parent_slot_id  uuid references public.bracket_slots(id) on delete restrict,  -- winner feeds into; NULL for Champion
  fixture_id      uuid references public.fixtures(id) on delete set null,       -- which match decides this slot; nullable until set
  resolved_team_id uuid references public.teams(id) on delete set null,         -- set by admin after the match (Phase 2)
  created_at      timestamptz not null default now(),
  unique (tournament_id, slot_code)
);
create index bracket_slots_tournament_idx on public.bracket_slots (tournament_id);
create index bracket_slots_stage_idx      on public.bracket_slots (stage);

-- ============================================================
-- 6. Bracket picks (Phase 3 writes; zero rows in Phase 1)
-- ============================================================
create table public.bracket_picks (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  slot_id         uuid not null references public.bracket_slots(id) on delete cascade,
  team_id         uuid not null references public.teams(id) on delete restrict,
  submitted_at    timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (user_id, slot_id)
);
create index bracket_picks_user_idx on public.bracket_picks (user_id);
create index bracket_picks_slot_idx on public.bracket_picks (slot_id);

-- ============================================================
-- 7. Predictions (Phase 2 writes; zero rows in Phase 1; RLS-protected from day 1)
-- ============================================================
create table public.predictions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  fixture_id      uuid not null references public.fixtures(id) on delete cascade,
  home_score      smallint not null check (home_score between 0 and 99),
  away_score      smallint not null check (away_score between 0 and 99),
  submitted_at    timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (user_id, fixture_id)
);
create index predictions_user_idx    on public.predictions (user_id);
create index predictions_fixture_idx on public.predictions (fixture_id);

-- ============================================================
-- 8. Prop questions (DATA-05; bilingual; admin authors in Phase 2; structured answer types)
-- ============================================================
create table public.prop_questions (
  id              uuid primary key default gen_random_uuid(),
  tournament_id   uuid not null references public.tournament(id) on delete cascade,
  code            text not null,             -- internal stable key, e.g. 'WINNER', 'TOP_SCORER'
  prompt_en       text not null,
  prompt_he       text not null,
  answer_type     text not null check (answer_type in ('single_team','single_player','text')),
  points          smallint not null default 0 check (points >= 0),
  correct_answer  text,                       -- set by admin once known (Phase 2)
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (tournament_id, code)
);

-- ============================================================
-- 9. Prop answers (Phase 2 writes; zero rows in Phase 1)
-- ============================================================
create table public.prop_answers (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  question_id     uuid not null references public.prop_questions(id) on delete cascade,
  answer          text not null,
  submitted_at    timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (user_id, question_id)
);
create index prop_answers_user_idx     on public.prop_answers (user_id);
create index prop_answers_question_idx on public.prop_answers (question_id);
