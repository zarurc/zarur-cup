-- ============================================================
-- Migration 0021 — buy-in ledger
--
-- Project pivot 2026-05-29: the family pool now has a $30 buy-in
-- with a 60/30/10 top-three prize split. The app is a LEDGER ONLY
-- — money moves out-of-band (Bit / Venmo / cash) and the admin
-- ticks people off on /admin/roster as they pay.
--
-- Schema:
--   - tournament.buyin_amount_usd  smallint (default 0 = "no buy-in")
--   - tournament.prize_split_pct   smallint[] (e.g., {60,30,10})
--   - profiles.buyin_paid_at       timestamptz (NULL = unpaid)
--
-- WC2026 is updated to (30, {60,30,10}). Future tournaments seed
-- their own values.
-- ============================================================

alter table public.tournament
  add column if not exists buyin_amount_usd smallint not null default 0,
  add column if not exists prize_split_pct  smallint[] not null default '{}';

comment on column public.tournament.buyin_amount_usd is
  'Per-user buy-in in whole USD. 0 means no money (family-trust pool).';
comment on column public.tournament.prize_split_pct is
  'Prize distribution as integer percentages summing to 100. Element 0 = 1st place share, element 1 = 2nd, etc. Empty array means no split configured.';

alter table public.profiles
  add column if not exists buyin_paid_at timestamptz;

comment on column public.profiles.buyin_paid_at is
  'Timestamp when admin marked this user as having paid the tournament buy-in. NULL = unpaid. Out-of-band payments only — see /admin/roster for the toggle.';

-- Seed WC2026 — $30 buy-in, 60/30/10 split.
update public.tournament
   set buyin_amount_usd = 30,
       prize_split_pct  = ARRAY[60, 30, 10]::smallint[]
 where code = 'WC2026';

-- Smoke.
do $$
declare v_amount smallint; v_split smallint[];
begin
  select buyin_amount_usd, prize_split_pct
    into v_amount, v_split
    from public.tournament where code = 'WC2026';
  if v_amount <> 30 then
    raise exception '0021 smoke failed: WC2026 buyin_amount_usd = %, expected 30', v_amount;
  end if;
  if v_split <> ARRAY[60,30,10]::smallint[] then
    raise exception '0021 smoke failed: WC2026 prize_split_pct = %, expected {60,30,10}', v_split;
  end if;
end$$;
