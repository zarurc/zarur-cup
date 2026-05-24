---
phase: 01-foundation-schema-auth-rls
reviewed: 2026-05-24T00:00:00Z
depth: standard
files_reviewed: 33
files_reviewed_list:
  - src/app/actions/join.ts
  - src/app/actions/locale.ts
  - src/app/actions/signout.ts
  - src/app/api/heartbeat/route.ts
  - src/app/[locale]/layout.tsx
  - src/app/[locale]/page.tsx
  - src/app/[locale]/join/page.tsx
  - src/app/[locale]/me/page.tsx
  - src/app/[locale]/bracket/page.tsx
  - src/app/[locale]/leaderboard/page.tsx
  - src/app/[locale]/matches/page.tsx
  - src/app/[locale]/not-found.tsx
  - src/app/admin/layout.tsx
  - src/app/admin/(protected)/layout.tsx
  - src/app/admin/(protected)/page.tsx
  - src/app/admin/403/page.tsx
  - src/components/auth/JoinForm.client.tsx
  - src/components/layout/BottomTabBar.tsx
  - src/components/layout/Header.tsx
  - src/components/layout/LocaleTogglePill.client.tsx
  - src/components/layout/Wordmark.tsx
  - src/components/layout/EmptyStateCard.tsx
  - src/components/ui/FormField.tsx
  - src/lib/auth/admin.ts
  - src/lib/auth/session.ts
  - src/lib/i18n/routing.ts
  - src/lib/i18n/request.ts
  - src/lib/schemas/displayName.ts
  - src/lib/schemas/join.ts
  - src/lib/supabase/server.ts
  - src/lib/supabase/client.ts
  - src/lib/supabase/service.ts
  - src/lib/supabase/middleware.ts
  - src/middleware.ts
  - supabase/migrations/0001_init.sql
  - supabase/migrations/0002_rls.sql
  - supabase/migrations/0003_grants.sql
  - supabase/migrations/0004_anon_select.sql
  - supabase/migrations/0005_seed_wc2026.sql
  - supabase/migrations/0006_reseed_wc2026.sql
  - scripts/build-seed-sql.ts
  - scripts/verify-rls-no-leak.sh
  - scripts/verify-heartbeat.sh
  - next.config.ts
  - vercel.json
  - eslint.config.mjs
  - .github/workflows/lint.yml
  - .husky/pre-commit
findings:
  critical: 0
  warning: 6
  info: 7
  total: 13
status: issues_found
---

# Phase 1: Code Review Report

**Reviewed:** 2026-05-24
**Depth:** standard
**Files Reviewed:** 33 source files + 12 supporting (config / migrations / scripts)
**Status:** issues_found (0 BLOCKER · 6 WARNING · 7 INFO)

## Summary

This is a tight, security-conscious Phase 1 implementation. The high-stakes
surfaces — the `signInAnonymously()` → invite-code → rebind flow, the
service-role isolation (`server-only` guard), the column-level GRANT defense
on `profiles.is_admin`, the `(select auth.uid())` RLS pattern, the
heartbeat's opt-in `CRON_SECRET` guard, and the lock-and-reveal predicates
on `predictions` / `prop_answers` — are all done correctly and well-documented
in code comments. `getClaims()` is used exclusively (zero `getSession()`
occurrences in source). Service-role usage is confined to `lib/supabase/service.ts`
and the two callers (`/api/heartbeat`, `joinPool` rebind). No
`dangerouslySetInnerHTML`, no `eval`, no `as any`. The FND-03 lint script
correctly blocks physical-direction Tailwind utilities and inline `left/right`
styles.

**No BLOCKERs were found.** Every finding below is a quality or robustness
issue, not a shipping-blocker. The two most material concerns are both in
the `rebindExistingProfile()` flow:

1. **WR-01 (NFC mismatch in rebind lookup)** — the rebind's lookup string is
   missing `.normalize('NFC')`, which can cause the lookup to miss the
   profile that just triggered the 23505. This is a *real* correctness gap
   on Hebrew composed/decomposed input.
2. **WR-02 (non-atomic rebind)** — the rebind issues five sequential network
   round-trips without a transaction; mid-flight failure leaves FK children
   split across two `auth.users` ids.

Both are tractable in <30 min of work each. WR-01 is the more user-visible
of the two.

The remaining warnings are smaller (multi-space display names accepted,
server-TZ date formatting on `/me`, weak open-redirect mitigation, stale
0005 seed kept in migration history); the infos cluster around minor style /
defense-in-depth polish.

The documented "family-trust account takeover" via rebind + invite-code is
NOT flagged as a finding — it is an explicit, accepted security posture
recorded in `STATE.md` ("Security posture: family-trust account takeover
ACCEPTED for v1") and `PROJECT.md` ("family trust covers anti-cheat").

## Warnings

### WR-01: Rebind lookup missing NFC normalization

**File:** `src/app/actions/join.ts:178`

**Issue:** `rebindExistingProfile()` computes the lookup key as

```ts
const normalized = opts.displayName.trim().toLowerCase();
```

but the database column it's matching against is

```sql
display_name_normalized text generated always as
  (lower(trim(normalize(display_name, NFC)))) stored
```

The lookup is therefore **missing the `normalize(..., NFC)` step**. Zod's
`.trim()` does NOT perform Unicode normalization; the in-code comment that
justifies the omission ("we use the trimmed input value the schema already
normalized") is incorrect on this point.

**Why it matters:** The 23505 unique-violation fires when the DB's
NFC-normalized form of the new input collides with an existing row's
NFC-normalized form. For Hebrew letters with combining marks (niqqud) or
accented Latin characters that have both composed (NFC) and decomposed (NFD)
representations, the input string and the existing row's pre-normalized
`display_name` can disagree even though the DB's normalized columns agree.
The lookup `.eq('display_name_normalized', normalized)` then returns no row,
`rebindExistingProfile` returns `false`, the new user is signed out, and the
user sees `profile_failed` — trapped out of an account that they just proved
they have access to (correct invite code + display name). This negates the
entire purpose of the rebind path.

In practice the failure window is narrow (most browser keyboards emit NFC,
and Heebo input typically composes), but the bug is real and the fix is
trivial.

**Fix:** Either reuse the shared helper or inline NFC:

```ts
// import { normalizeDisplayName } from '@/lib/schemas/displayName';
const normalized = normalizeDisplayName(opts.displayName);
// or inline:
// const normalized = opts.displayName.trim().normalize('NFC').toLowerCase();
```

Use `normalizeDisplayName` for symmetry with `isAdminDisplayName()` — both
should converge on the exact normalization the DB column applies.

---

### WR-02: Rebind is non-atomic across 5 round-trips; partial failure leaves split-FK orphans

**File:** `src/app/actions/join.ts:202-227`

**Issue:** `rebindExistingProfile()` performs (1) profile UPDATE, (2-4) child
UPDATE loop over `predictions` / `bracket_picks` / `prop_answers`, (5)
`auth.admin.deleteUser`. These five calls are independent network round-trips
to Supabase / PostgREST. If, say, the `bracket_picks` UPDATE fails after the
`predictions` UPDATE succeeded, the function `return false` — but **the
partial migration is not rolled back**. State after the failure:

- `profiles.user_id` → newUserId
- `predictions.user_id` → newUserId
- `bracket_picks.user_id` → still oldUserId
- `prop_answers.user_id` → still oldUserId
- old auth.users row → still exists

The caller (`joinPool`) then signs out the new user. On the **next** join
attempt with the same display_name, the rebind lookup finds the profile
under newUserId, treats that as `oldUserId`, and moves children from
newUserId to newUserId2 — **but never moves the bracket_picks/prop_answers
still stuck under the original oldUserId**. Those rows are now permanently
orphaned (referencing a soon-to-be-deleted auth user once cleanup runs).

The W7 comment block acknowledges an orphan-row risk but only for the
"signInAnonymously succeeded but profile INSERT failed" branch — it does
NOT discuss this rebind-mid-flight split.

**Why it matters:** In a 15-person family this is unlikely to fire, but when
it does the user silently loses bracket/props picks that they made on a
prior device. This is *exactly* the trust violation the rebind path was
introduced to prevent.

**Fix (minimal):** Wrap the five operations in a single `rpc()` call to a
Postgres function that performs all updates inside one transaction. Sketch:

```sql
create or replace function rebind_profile(p_old_user uuid, p_new_user uuid, p_locale text)
returns void language plpgsql security definer as $$
begin
  update public.profiles set user_id = p_new_user, locale = p_locale
    where user_id = p_old_user;
  update public.predictions   set user_id = p_new_user where user_id = p_old_user;
  update public.bracket_picks set user_id = p_new_user where user_id = p_old_user;
  update public.prop_answers  set user_id = p_new_user where user_id = p_old_user;
end$$;
```

Call via `svc.rpc('rebind_profile', { p_old_user, p_new_user, p_locale })`
then `svc.auth.admin.deleteUser(oldUserId)` afterwards. Now the four UPDATEs
are atomic; the delete remains separate but its failure mode (already
acknowledged) is benign.

**Alternative (cheap):** Leave the loop, but on any in-loop failure issue
compensating UPDATEs to roll back to oldUserId before `return false`.

---

### WR-03: `displayNameSchema` accepts arbitrary consecutive spaces; D-07 implies single space

**File:** `src/lib/schemas/displayName.ts:22`

**Issue:** D-07 (CONTEXT.md) reads: "Hebrew letters, Latin letters, digits,
ASCII space (between non-space chars only — no leading/trailing whitespace
after trim)." The "between non-space chars only" reads naturally as a
single-space separator. The current regex `^[\p{L}\d ]+$` accepts
`"a    b"` (four spaces). The DB has no CHECK to catch this. Two family
members named `"D ani"` and `"D    ani"` would normalize to two distinct
rows that look identical at default whitespace rendering.

**Why it matters:** Two visually-identical leaderboard names break the
"argue about it at dinner" UX. Display-name confusion is also one of the
few non-trivial v1 abuse surfaces (the rebind path lets anyone with the
invite code claim any name; visual confusion expands the squat surface).

**Fix:** Collapse runs of internal whitespace at validation time, or reject
double-space outright:

```ts
.refine((s) => !/  /.test(s), 'name_chars')
```

The error key `name_chars` already has a localized message; this is a
two-line change.

---

### WR-04: `/me` `joined_at` formatted in server timezone, not the user's locale TZ

**File:** `src/app/[locale]/me/page.tsx:27-30`

**Issue:** `new Intl.DateTimeFormat(locale === 'he' ? 'he-IL' : 'en-US', { dateStyle: 'long' }).format(new Date(member.joined_at))`
runs in the RSC server context (Vercel functions default to UTC). With only
`dateStyle: 'long'` and no `timeZone`, the formatter uses the runtime's TZ.
A family member in Asia/Jerusalem (UTC+2 / +3) who joined at 22:30 UTC on
June 11 will see "June 11" — but in their local time they joined at
01:30 on June 12. The display is off-by-one for late-evening-UTC joins.

PROJECT.md explicitly calls out "Locking ... UTC-aware, since family spans
timezones." The same discipline should apply to user-facing date display.

**Why it matters:** Visible to every user on `/me`. Mostly cosmetic, but
inconsistent with the project's stated TZ correctness commitment, and an
easy fix.

**Fix:** Either format with the user's intended TZ (Asia/Jerusalem is a
sensible default for this family pool) or render on the client where the
browser provides `Intl.DateTimeFormat().resolvedOptions().timeZone`:

```ts
const joinedAtLocal = new Intl.DateTimeFormat(
  locale === 'he' ? 'he-IL' : 'en-US',
  { dateStyle: 'long', timeZone: 'Asia/Jerusalem' },
).format(new Date(member.joined_at));
```

A more locale-honest fix would be a tiny client component that uses the
browser's TZ; for Phase 1's "thin-live `/me`" surface, the hardcoded
`Asia/Jerusalem` is acceptable and explicit.

---

### WR-05: `switchLocale` open-redirect mitigation does not normalize backslashes or control chars

**File:** `src/app/actions/locale.ts:42-47`

**Issue:** The path-validation guard is:

```ts
if (
  typeof redirectPathRaw === 'string' &&
  redirectPathRaw.startsWith('/') &&
  !redirectPathRaw.startsWith('//')
) {
  redirectPath = redirectPathRaw;
}
```

This is the textbook "no protocol-relative" check, but it does NOT defend
against:

- backslash-prefixed paths (`/\evil.com`) — some older browsers and HTTP
  middleboxes treat `\` and `/` interchangeably for path normalization
- CR/LF injection (`/he/foo\r\nLocation: https://evil`) — Next's
  `redirect()` likely encodes these, but the guard does not strip them
- Whitespace-prefixed paths (`/  https://evil.com`)

The `redirectPath` is cast to `Route` and passed to `redirect()`, which sets
a `Location` header. Next.js's runtime header serialization should reject
CR/LF, and modern browsers all parse `\` as a path component — so the
**realized** attack surface is low. But this is a server action that
accepts an untrusted form field and uses it directly as a redirect target;
the guard should match what the OWASP redirect-validation cheat sheet
recommends.

**Why it matters:** Defense in depth on the one server action that takes
free-form path input from the client. Low-severity given Next.js's own
header sanitization, but easy to harden.

**Fix:** Either route through `URL` parsing to extract `pathname` only, or
tighten the regex:

```ts
const SAFE_PATH = /^\/[a-zA-Z0-9/_\-.~%]*$/;
if (typeof redirectPathRaw === 'string' && SAFE_PATH.test(redirectPathRaw)) {
  redirectPath = redirectPathRaw;
}
```

Restrict to ASCII path characters that the next-intl `getPathname()` helper
would actually emit (locale-prefixed routes like `/he/me`, `/en/admin/foo`).

---

### WR-06: `displayNameSchema.refine()` is unreachable after `.trim()`

**File:** `src/lib/schemas/displayName.ts:23`

**Issue:** The schema is `z.string().trim().min(2).max(24).regex(...).refine((s) => !/^\s|\s$/.test(s), 'name_chars')`.
`.trim()` runs first in the Zod pipeline; by the time `refine` sees the
string, leading/trailing whitespace has already been removed. The
`/^\s|\s$/` check therefore can never be true and the refine never fires.
This is harmless at runtime but reads as dead code that asserts a guarantee
that's actually provided one line above.

The comment above the schema even says "the trim() in front handles the
most common case; the refine catches embedded edge cases" — but the refine
as written does NOT catch embedded whitespace, only leading/trailing. The
intent (catch double-space, embedded tabs, etc.) is not implemented.

**Why it matters:** Either remove the dead refine, or rewrite it to do what
the comment claims. Right now the schema permits embedded weird whitespace
(see WR-03) while running a refine that does nothing.

**Fix:** Combine with WR-03's fix — replace the dead refine with a real
internal-whitespace check:

```ts
.refine((s) => !/\s{2,}/.test(s), 'name_chars')   // no double-space
// or, stricter:
.refine((s) => !/[\t\n\r\f\v]/.test(s), 'name_chars') // no non-ASCII-space whitespace
```

## Info

### IN-01: Heartbeat `CRON_SECRET` comparison is not timing-safe

**File:** `src/app/api/heartbeat/route.ts:32`

**Issue:** `auth !== \`Bearer ${cronSecret}\`` exits at the first byte that
mismatches. In theory this allows a remote timing attack against the
secret. In practice the attack requires sub-millisecond network jitter
distinguishability against a single endpoint that does ~700ms of DB work
per call — a brute-force-friendly cron secret is far more likely to be the
weak link. For a low-stakes heartbeat in a 15-user family pool this is
**fine to defer**, but if `CRON_SECRET` is ever reused for a higher-stakes
admin endpoint it should be `crypto.timingSafeEqual`.

**Fix (optional):**

```ts
import { timingSafeEqual } from 'node:crypto';
const expected = Buffer.from(`Bearer ${cronSecret}`);
const actual = Buffer.from(auth ?? '');
if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
  return new Response('Unauthorized', { status: 401 });
}
```

---

### IN-02: Inconsistent response shape on heartbeat 401

**File:** `src/app/api/heartbeat/route.ts:33`

**Issue:** Success/error paths return `NextResponse.json({...})`; the 401
path returns `new Response('Unauthorized', { status: 401 })`. Consumers
(your `verify-heartbeat.sh`, Vercel cron's log scraping) have to handle two
content-types. Trivial style nit.

**Fix:**

```ts
return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
```

---

### IN-03: Profiles `is_admin` and `joined_at` are readable by every authenticated user

**File:** `supabase/migrations/0002_rls.sql:27-29`

**Issue:** `profiles_read_all` is `using (true) for select to authenticated`.
Every signed-in user can `SELECT *` and see who's admin and when each
member joined. The comment explicitly accepts this for the leaderboard
("All authenticated users can read all profiles ... family pool trust
model. If we ever wanted to redact, we'd add a column-level grant.").

**Why it matters:** Not a bug — fully documented intent — but if a Phase 2
surface exposes profile data via PostgREST it would leak `is_admin` to
clients. Worth a column-level GRANT (e.g. revoke SELECT on `is_admin`) the
moment the leaderboard ships, even though it's not in scope for Phase 1.

**Fix:** Defer to Phase 2; this is informational only.

---

### IN-04: `/[locale]/page.tsx` double-redirect reads awkwardly

**File:** `src/app/[locale]/page.tsx:17-18`

**Issue:**

```ts
if (!member) redirect(`/${locale}/join` as Route);
redirect(`/${locale}/matches` as Route);
```

`redirect()` throws, so this works — but a reader has to know that to
understand why the second redirect is reachable. An `else` makes intent
obvious.

**Fix:**

```ts
if (!member) redirect(`/${locale}/join` as Route);
else redirect(`/${locale}/matches` as Route);
```

---

### IN-05: 0005 seed remains in migration history with known-wrong WC 2026 group draw

**File:** `supabase/migrations/0005_seed_wc2026.sql`

**Issue:** Per Plan 01-03 deviation notes and 0006's header comment, 0005
seeds pre-draw projected groups that include teams that didn't qualify
(Italy, Denmark, Poland, etc.) and is then superseded by 0006's reseed.
The "append-only migrations" policy correctly forbids editing 0005, so
0005 will run on every fresh `db:reset` before 0006 cleans up. It's
not incorrect (0005's integrity DO block passes because the CSV at the
time had 48/104 rows that satisfied the count constraint), but a fresh
Postgres provisioning runs ~2 seconds of throwaway work and creates 48 +
104 + 32 + N rows that the very next migration deletes.

**Why it matters:** Pure waste, not a correctness issue. Anyone running
`db:reset` repeatedly will notice. Could be mitigated with a single-line
guard at the top of 0005 (`-- this migration is superseded by 0006; skip
on fresh deploys` + an `EXIT` block) but doing so violates the append-only
convention. Recommend living with it.

---

### IN-06: Header comment in `joinPool` references "fix-up plan 01-04, Bug 1b" — stale planning reference in shipped code

**File:** `src/app/actions/join.ts:25`

**Issue:** Production source comments reference plan/bug IDs that only live
in `.planning/`. Useful while the phase is fresh; less useful when a future
contributor (or you in 4 weeks) reads "Bug 1b" without context. Either
prune to the rationale ("Family-trust rebind on display-name collision; see
STATE.md security posture") or keep but accept the staleness.

**Fix:** Style preference — defer or prune. Affects ~6 source files.

---

### IN-07: `redirectPath` validation in `switchLocale` allows `/admin/...` paths

**File:** `src/app/actions/locale.ts:40-47`

**Issue:** The redirect-path guard accepts anything starting with `/` and
not `//`. Including `/admin`. A `<form action={switchLocale}>` POST with
`redirectPath=/admin/dashboard` would set `NEXT_LOCALE=he` and then
redirect to `/admin/dashboard`. The admin layout's `requireAdmin()` would
catch non-admins and bounce to `/admin/403`, so this is **not** a
privilege escalation — it just lets a logged-in non-admin trigger a 1-hop
redirect into the admin gate. Harmless.

**Why it matters:** Defensive note only. If you ever want to constrain the
locale toggle to "stay on a `[locale]`-prefixed route," add an explicit
prefix check.

**Fix (optional):**

```ts
if (
  typeof redirectPathRaw === 'string' &&
  /^\/(he|en)(\/|$)/.test(redirectPathRaw)
) {
  redirectPath = redirectPathRaw;
}
```

---

*Reviewed: 2026-05-24*
*Reviewer: Claude (gsd-code-reviewer)*
*Depth: standard*
