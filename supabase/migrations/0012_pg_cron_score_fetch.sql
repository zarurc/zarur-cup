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
-- Secret storage: Supabase Vault (NOT GUC). Managed Supabase blocks
-- `ALTER DATABASE postgres SET <custom_guc>` (42501 permission denied)
-- because the SQL Editor's `postgres` role is not a true PG superuser
-- and PG 15+ requires GRANT SET ON PARAMETER for non-built-in GUCs.
-- Vault is Supabase's blessed pattern for pg_cron + pg_net secrets.
--
-- USER-SETUP required BEFORE this migration applies (it will raise if
-- the Vault secret is not provisioned):
--   select vault.create_secret(
--     '<SCORE_FETCH_SECRET value>',
--     'score_fetch_secret',
--     'Bearer token for /api/score-fetch — used by pg_cron job zarur-score-fetch'
--   );
-- (See 02-USER-SETUP.md § 4 for the full setup checklist.)
-- ============================================================

-- 1. Enable extensions (idempotent).
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- 2. Pre-check: the Vault secret must exist BEFORE we schedule the cron,
--    otherwise the cron will silently send `Bearer ` (empty) every 15
--    minutes and the route will return 401 forever. Fail loudly here.
do $$
declare
  secret_value text;
begin
  select decrypted_secret into secret_value
    from vault.decrypted_secrets
   where name = 'score_fetch_secret';

  if secret_value is null or length(secret_value) < 16 then
    raise exception
      '0012 migration blocked: Vault secret "score_fetch_secret" is missing or too short. Insert it via Supabase Dashboard → SQL Editor BEFORE running db push (see 02-USER-SETUP.md § 4).';
  end if;
end;
$$;

-- 3. Drop existing job if present (makes the migration re-applicable in dev).
do $$
begin
  if exists (select 1 from cron.job where jobname = 'zarur-score-fetch') then
    perform cron.unschedule('zarur-score-fetch');
  end if;
end;
$$;

-- 4. Schedule the job. */15 every 15 min; the route handler short-circuits
--    outside the tournament window so non-tournament polls are cheap.
--    Body is a SINGLE net.http_post call — no inline SELECT/UPDATE so a
--    future schema drift can't break the cron silently (Research Addendum
--    D-44 Open Risk #3). The Vault subquery executes each tick, so secret
--    rotations take effect on the next */15 boundary without re-pushing
--    this migration.
select cron.schedule(
  'zarur-score-fetch',
  '*/15 * * * *',
  $cron$
    select net.http_post(
      url := 'https://zarur-cup.vercel.app/api/score-fetch',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'score_fetch_secret'),
        'Content-Type', 'application/json'
      ),
      body := jsonb_build_object('source', 'pg_cron'),
      timeout_milliseconds := 9000
    );
  $cron$
);

-- 5. B-style smoke: confirm the job exists + references the correct URL +
--    references Vault (not the legacy GUC path).
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

  if position('vault.decrypted_secrets' in job_command) = 0 then
    raise exception
      '0012 migration failed: cron job does not reference the Vault secret. Got: %', job_command;
  end if;
end;
$$;
