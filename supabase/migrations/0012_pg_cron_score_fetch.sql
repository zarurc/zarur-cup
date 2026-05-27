-- ============================================================
-- Migration 0012 — pg_cron + pg_net for /api/score-fetch (D-45 + AUTO-03)
--
-- Why pg_cron: Vercel Hobby caps cron frequency at once-per-day max
-- (verified against vercel.com/docs/cron-jobs/usage-and-pricing). Our
-- score-fetch needs */15 polling during the tournament window. Free
-- options: (a) upgrade to Vercel Pro $20/mo, (b) Supabase pg_cron +
-- pg_net calling our route, (c) GitHub Actions schedule. Operator
-- chose (b) per D-45.
--
-- The existing /api/heartbeat cron on Vercel (3-day Supabase anti-pause
-- ping) is UNTOUCHED — heartbeat and score-fetch live in separate route
-- handlers and separate schedulers. Failure isolation is a feature.
--
-- USER-SETUP step required BEFORE this migration's cron will succeed:
--   ALTER DATABASE postgres SET app.score_fetch_secret TO '<value>';
-- (See 02-USER-SETUP.md for the full setup checklist.)
-- ============================================================

-- 1. Enable extensions (idempotent).
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- 2. Drop existing job if present (makes the migration re-applicable in dev).
do $$
begin
  if exists (select 1 from cron.job where jobname = 'zarur-score-fetch') then
    perform cron.unschedule('zarur-score-fetch');
  end if;
end;
$$;

-- 3. Schedule the job. */15 every 15 min; the route handler short-circuits
--    outside the tournament window so non-tournament polls are cheap.
--    Body is a SINGLE net.http_post call — no inline SELECT/UPDATE so a
--    future schema drift can't break the cron silently (Research Addendum
--    D-44 Open Risk #3).
select cron.schedule(
  'zarur-score-fetch',
  '*/15 * * * *',
  $cron$
    select net.http_post(
      url := 'https://zarur-cup.vercel.app/api/score-fetch',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.score_fetch_secret', true),
        'Content-Type', 'application/json'
      ),
      body := jsonb_build_object('source', 'pg_cron'),
      timeout_milliseconds := 9000
    );
  $cron$
);

-- 4. B-style smoke: confirm the job exists + references the correct URL.
do $$
declare
  job_command text;
begin
  select command into job_command
    from cron.job
   where jobname = 'zarur-score-fetch';

  if job_command is null then
    raise exception
      '0012 migration failed: cron job zarur-score-fetch was not registered';
  end if;

  if position('zarur-cup.vercel.app/api/score-fetch' in job_command) = 0 then
    raise exception
      '0012 migration failed: cron job does not reference /api/score-fetch URL. Got: %', job_command;
  end if;

  if position('app.score_fetch_secret' in job_command) = 0 then
    raise exception
      '0012 migration failed: cron job does not reference the secret GUC. Got: %', job_command;
  end if;
end;
$$;
