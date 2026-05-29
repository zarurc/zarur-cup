/**
 * Resolve admin-mutation redirect query params into a toast payload.
 *
 * Shared helper so /admin/props, /admin/tournament-tree, and
 * /admin/roster all map their action redirect shapes consistently.
 * Returns null when no recognized param is present (page renders no
 * toast).
 *
 * Supported keys:
 *   - saved=1                → "Saved"           (success)
 *   - graded=<question_id>   → "Grade saved"     (success)
 *   - resolved=<placeholder> → "Resolved {p}"    (success)
 *   - merged=1               → "Merge complete"  (success)
 *   - renamed=1              → "Renamed"         (success — R3)
 *   - promoted=1             → "Promoted"        (success — R4)
 *   - demoted=1              → "Demoted"         (success — R4)
 *   - error=<message>        → "Error: {message}" (error)
 *      • error=name_taken  → "Name already taken"
 *      • error=last_admin  → "Can't remove the last admin"
 *
 * Unknown keys fall through to null so a stray query param doesn't
 * render a misleading banner.
 */
export type AdminToastPayload =
  | { tone: 'success' | 'error'; message: string }
  | null;

export function resolveAdminToast(
  sp: Record<string, string | string[] | undefined>,
): AdminToastPayload {
  const pick = (k: string): string | null => {
    const v = sp[k];
    if (Array.isArray(v)) return v[0] ?? null;
    return typeof v === 'string' ? v : null;
  };

  const err = pick('error');
  if (err) {
    const friendly =
      err === 'name_taken'
        ? "Name already taken"
        : err === 'last_admin'
          ? "Can't remove the last admin"
          : err;
    return { tone: 'error', message: `Error: ${friendly}` };
  }

  if (pick('saved')) return { tone: 'success', message: 'Saved' };
  if (pick('graded')) return { tone: 'success', message: 'Grade saved' };
  if (pick('merged')) return { tone: 'success', message: 'Merge complete' };
  if (pick('renamed')) return { tone: 'success', message: 'Renamed' };
  if (pick('promoted')) return { tone: 'success', message: 'Promoted to admin' };
  if (pick('demoted')) return { tone: 'success', message: 'Removed admin' };
  if (pick('paid')) return { tone: 'success', message: 'Marked paid' };
  if (pick('unpaid')) return { tone: 'success', message: 'Marked unpaid' };

  const resolved = pick('resolved');
  if (resolved) {
    return { tone: 'success', message: `Resolved ${resolved}` };
  }

  return null;
}
