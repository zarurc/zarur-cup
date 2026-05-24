import { z } from 'zod';

/**
 * D-07: 2-24 chars; Hebrew letters, Latin letters, digits, and ASCII space.
 *
 * Notes on the regex:
 *   - \p{L} matches any Unicode letter (Hebrew + Latin both)
 *   - \d matches digits
 *   - ASCII space is included explicitly
 *   - The trailing refine forbids leading/trailing whitespace (the trim() in front
 *     handles the most common case; the refine catches embedded edge cases).
 *
 * The trim + NFC normalization for storage happens via the shared
 * normalizeDisplayName() helper (also used by the join action to compute
 * is_admin) so it matches the Postgres display_name_normalized generated column.
 */
export const displayNameSchema = z
  .string()
  .trim()
  .min(2, 'name_length')
  .max(24, 'name_length')
  .regex(/^[\p{L}\d ]+$/u, 'name_chars')
  .refine((s) => !/^\s|\s$/.test(s), 'name_chars');

export type DisplayName = z.infer<typeof displayNameSchema>;

/**
 * Shared normalization helper - used by both the join Server Action (to compute
 * is_admin via env-var match) and conceptually mirrors what the DB
 * display_name_normalized generated column does so the admin gate is
 * deterministic across re-joins.
 */
export function normalizeDisplayName(s: string): string {
  return s.trim().normalize('NFC').toLowerCase();
}
