import 'server-only';
import { normalizeDisplayName } from '@/lib/schemas/displayName';

/**
 * D-04: Admin identity is established by env-var display-name match at join
 * time. Returns true iff ADMIN_DISPLAY_NAME is set AND the normalized input
 * matches.
 *
 * Normalization (trim + NFC + lower) MUST match what the DB generated column
 * (`display_name_normalized`) does, so the admin gate is deterministic across
 * re-joins: if the env var says "Zeke" and the user types "zeke" or "  ZEKE
 * ", they all collapse to the same normalized form.
 *
 * NOTE: is_admin is set on profiles ONLY at INSERT time (the join action).
 * The column-level GRANT in supabase/migrations/0002_rls.sql prevents
 * authenticated users from ever UPDATE'ing it. So this helper running on a
 * "spoofed" display name still cannot escalate an existing non-admin profile.
 */
export function isAdminDisplayName(displayName: string): boolean {
  const adminName = process.env.ADMIN_DISPLAY_NAME;
  if (!adminName) return false;
  return normalizeDisplayName(displayName) === normalizeDisplayName(adminName);
}
