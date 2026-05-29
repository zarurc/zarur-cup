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
 *   - error=<message>        → "Error: {message}" (error)
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
  if (err) return { tone: 'error', message: `Error: ${err}` };

  if (pick('saved')) return { tone: 'success', message: 'Saved' };
  if (pick('graded')) return { tone: 'success', message: 'Grade saved' };
  if (pick('merged')) return { tone: 'success', message: 'Merge complete' };

  const resolved = pick('resolved');
  if (resolved) {
    return { tone: 'success', message: `Resolved ${resolved}` };
  }

  return null;
}
