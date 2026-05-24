# Phase 1: Foundation, Schema, Auth & RLS - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-23
**Phase:** 1-Foundation-Schema-Auth-RLS
**Areas discussed:** Invite-code model, Admin bootstrap, Display-name policy, Brand & shell aesthetic, Late-entrant policy, Locale toggle UX

---

## Invite-code model

### Q1: How is the invite code stored and managed?

| Option | Description | Selected |
|--------|-------------|----------|
| Single static code in env var | INVITE_CODE on Vercel; Server Action compares against process.env. Rotation via env-var change. Matches CLAUDE.md. | ✓ |
| Single code in DB, admin-rotatable | One row in invite_codes table; admin rotates from UI without redeploy. | |
| Multiple codes (one per family member) | DB table of codes, each scoped/consumed once; lets you revoke individuals. Adds authoring step + friction. | |

**Notes:** Matches PROJECT.md "shared family invite code" wording; rotation via Vercel env var change is instant.

### Q2: How do you defend the invite-code endpoint from brute-force?

| Option | Description | Selected |
|--------|-------------|----------|
| Cloudflare Turnstile | Free invisible-ish CAPTCHA; CLAUDE.md endorses. Best protection, tiny friction. | |
| Per-IP attempt cap only | Track failed attempts in DB/KV; lock after N per hour. No third-party dep. | |
| Both | Defense in depth. | |
| Neither for v1 | Skip explicitly; rely on Supabase's built-in 30 anon-signins/hr/IP limit. Family-trust model. | ✓ |

**Notes:** Captured as a deliberate re-interpretation of AUTH-07 — the requirement is satisfied by Supabase's built-in rate limit. Capture in REQUIREMENTS.md traceability so it isn't flagged in audit.

---

## Admin bootstrap

### Q3: How does your profile get is_admin = true the first time you join?

| Option | Description | Selected |
|--------|-------------|----------|
| Env-var display name match | ADMIN_DISPLAY_NAME on Vercel; Server Action sets is_admin=true if chosen name matches exactly. Zero manual SQL, survives DB resets. | ✓ |
| Manual SQL after first sign-in | Run `update profiles set is_admin=true ...` once in Supabase SQL editor. | |
| Separate admin invite code | Two env vars: INVITE_CODE + ADMIN_INVITE_CODE; cleanest separation, one more secret. | |
| Seed your profile row in a migration | Migration 0001 inserts hardcoded profile; you claim it. More plumbing but reproducible. | |

**Notes:** Mitigation against name-squat: user (zekez) joins first. Idempotent across DB resets — re-join with the same name re-asserts admin.

### Q4: Should admin routes be bilingual or English-only?

| Option | Description | Selected |
|--------|-------------|----------|
| Bilingual under /[locale]/admin/... | Matches AUTH-06 literally. Translation work for screens only the admin sees. | |
| English-only at /admin/... | Skip [locale] segment for admin; fewer translations; deliberate deviation from AUTH-06's literal wording. | ✓ |
| Bilingual nav + English-only forms | Mixed approach; added complexity. | |

**Notes:** Deviation from AUTH-06's literal "/[locale]/admin/..." path; spirit (server-side gated, admin-only) preserved. Document in requirement traceability.

---

## Display-name policy

### Q5: What counts as a "duplicate" display name?

| Option | Description | Selected |
|--------|-------------|----------|
| Case-insensitive + trimmed + NFC-normalized | "Yossi"/"yossi"/"  Yossi  "/Hebrew composition variants all dupes. | ✓ |
| Case-insensitive + trimmed only | Hebrew variants treated as distinct; simpler. | |
| Exact string match only | "Yossi" and "yossi" are different people; simplest constraint. | |

**Notes:** Implementation: generated `display_name_normalized` column with unique index OR functional unique index. Planner picks based on Postgres ergonomics.

### Q6: Length and character rules?

| Option | Description | Selected |
|--------|-------------|----------|
| 2–24 chars, Hebrew + Latin + digits + spaces, no symbols | Permissive for nicknames; bans `<>/\&'";\``; emoji blocked for v1. | ✓ |
| 2–24 chars, any Unicode + emoji + symbols | Most permissive; rely entirely on render-time escaping. | |
| 1–32 chars, Hebrew + Latin + digits + spaces, no symbols | More room; otherwise same as Recommended. | |

### Q7: What happens on the join form when someone picks a taken name?

| Option | Description | Selected |
|--------|-------------|----------|
| Inline error + ask them to try again | Server Action returns useActionState error; no suggestions. | ✓ |
| Inline error + suggest variants | "Try: Yossi-2, Yossi K., ..." as clickable chips. | |
| Auto-append discriminator | Silently create "Yossi-2". Removes friction but surprising. | |

---

## Brand & shell aesthetic

### Q8: What's the visual personality?

| Option | Description | Selected |
|--------|-------------|----------|
| Warm & family | Terracotta/cream/muted green; rounded; hand-feel typography. | |
| Modern sports clean | High-contrast minimal; dark green or navy primary; single accent; geometric sans. | ✓ |
| Bold tournament-energy | Saturated red+blue+gold; strong type; FIFA-style. | |
| Playful retro-arcade | Pixel/retro accents; score-stamp; humor. | |

### Q9: Mobile nav pattern?

| Option | Description | Selected |
|--------|-------------|----------|
| Bottom tab bar | iOS/Android-native; 3–4 tabs (Matches/Bracket/Leaderboard/Me); thumb-reach. | ✓ |
| Top header + hamburger drawer | Reclaims vertical space; familiar pattern. | |
| Sticky top header with inline links only | Simplest; only ~3 destinations. | |

**Notes:** Flex-row + `dir` on <html> auto-flips tab order in Hebrew.

### Q10: Logo / wordmark direction?

| Option | Description | Selected |
|--------|-------------|----------|
| Text wordmark only | "משחקי זערור" / "Zarur Cup"; flip per locale; zero asset pipeline. | ✓ |
| Wordmark + small ball/trophy mark | Slightly more identity; one SVG. | |
| Full custom logo / family crest vibe | Bespoke logomark; ~half-day design work off critical path. | |
| No logo at all | Header reads as plain "Matches · Leaderboard." | |

### Q11: Hebrew + Latin typography pairing?

| Option | Description | Selected |
|--------|-------------|----------|
| Heebo (HE) + Inter (EN) | Both Google Fonts, both excellent on phones, ~80KB total. | ✓ |
| Assistant (HE) + Inter (EN) | More "corporate Hebrew" pairing. | |
| Rubik (covers both) | One family for both scripts; Latin slightly less crisp than Inter. | |
| System fonts only | Zero loading; Hebrew rendering varies by OS. | |

---

## Late-entrant policy

### Q12: Late-entrant policy?

| Option | Description | Selected |
|--------|-------------|----------|
| Open join, zero past points | Join any time; already-locked matches yield zero; profiles.joined_at column. | ✓ |
| Cutoff at first kickoff | Join page returns "pool is closed" after June 11. | |
| Admin-approval after first kickoff | Manual approval flow. | |

---

## Locale toggle UX

### Q13: Locale toggle placement and behavior?

| Option | Description | Selected |
|--------|-------------|----------|
| Header pill on inline-end; switches in place /he/foo ↔ /en/foo | Globe icon or HE/EN pill; persists to cookie + profiles.locale; always visible. | ✓ |
| In Me tab + header pill | Belt-and-suspenders discoverability. | |
| Only in Me tab | Hides from first-visit; bad if Hebrew default wrong for an EN speaker. | |

---

## Claude's Discretion

(Captured in CONTEXT.md `<decisions>` under "Claude's Discretion" — exact palette hex values, tab label wording, heartbeat response shape, bracket slot graph normalization, migration file naming, `display_name_normalized` column-vs-functional-index choice.)

## Deferred Ideas

(Captured in CONTEXT.md `<deferred>` — Cloudflare Turnstile reinstatement, bilingual admin, logo upgrade, admin merge-users tool, settings-page locale UI, all v2 features.)

---

*Discussion log for Phase 1, gathered 2026-05-23.*
