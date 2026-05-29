-- ============================================================
-- Migration 0020 — reset profiles.welcome_seen_at for testing
--
-- 0019 backfilled every existing profile to now() so already-onboarded
-- family members would skip the new welcome screen. This migration
-- walks that back: NULLs the column on every profile so every member
-- (including the maintainer running this) sees /welcome once on their
-- next page navigation through /[locale].
--
-- One-shot. Reapplying this migration on a re-run of db push is a
-- no-op for new profiles (they default NULL on INSERT) and a re-reset
-- for any profile that has already dismissed welcome in the meantime —
-- which is fine, it just means they see welcome again.
--
-- Idempotency: the migrations table tracks 0020 by filename. Once
-- applied to remote, db push won't run it again.
-- ============================================================

update public.profiles
   set welcome_seen_at = null
 where welcome_seen_at is not null;
