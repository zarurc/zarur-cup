import { adminReadClient } from '@/lib/auth/adminReadClient';
import { getTranslations } from 'next-intl/server';
import { RosterMergeForm } from '@/components/admin/RosterMergeForm.client';
import { AdminToast } from '@/components/admin/AdminToast.client';
import { resolveAdminToast } from '@/lib/admin/toast';

/**
 * /admin/roster — family roster + merge tool (ADM-05 + D-14).
 *
 * Reads every profile via adminReadClient (Pitfall 10 — service-role
 * sees all rows; the anon-RLS path would only return the admin's own
 * row, which would defeat the purpose of a roster page).
 *
 * Joins v_leaderboard (Plan 02-01 + 0011 service_role grant) to display
 * the total points alongside each row — this is the same view the
 * leaderboard page uses, so the admin sees the canonical totals.
 *
 * Non-admin rows get a RosterMergeForm (destructive — admin → admin
 * merges blocked by omitting the form on admin rows, which is also
 * defensive because deleting the only admin would brick admin access).
 * The Server Action additionally rejects source === target via Zod
 * .refine (T-02-06-03).
 *
 * NO requireAdmin() call here — parent layout enforces.
 */
type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminRosterPage({ searchParams }: PageProps) {
  const t = await getTranslations('admin.roster');
  const svc = await adminReadClient();
  const toast = resolveAdminToast(await searchParams);

  // Full roster, ordered by joined_at so admin sees the family
  // in their original arrival order.
  const { data: profiles } = await svc
    .from('profiles')
    .select('user_id, display_name, joined_at, locale, is_admin')
    .order('joined_at', { ascending: true });

  // Totals from v_leaderboard. Plan 02-01 + migration 0011 grants
  // SELECT to service_role on this view, so the read succeeds under
  // service-role auth. Map user_id → total for O(1) lookup per row.
  const { data: lb } = await svc.from('v_leaderboard').select('user_id, total');
  const totalsByUser = new Map<string, number>(
    (lb ?? [])
      .filter((r): r is { user_id: string; total: number | null } =>
        Boolean(r.user_id),
      )
      .map((r) => [r.user_id, r.total ?? 0]),
  );

  const profileList = profiles ?? [];
  const candidates = profileList.map((c) => ({
    user_id: c.user_id,
    display_name: c.display_name,
  }));

  return (
    <main className="pi-4 pbs-4 pbe-24">
      {toast && (
        <AdminToast
          key={`${toast.tone}:${toast.message}`}
          tone={toast.tone}
          message={toast.message}
        />
      )}
      <h1 className="text-xl font-bold mbs-2 mbe-4">{t('heading')}</h1>
      <ul>
        {profileList.map((p) => {
          const joinedFormatted = new Intl.DateTimeFormat('en-US', {
            dateStyle: 'medium',
          }).format(new Date(p.joined_at));
          return (
            <li
              key={p.user_id}
              className="flex items-center justify-between gap-3 pbs-3 pbe-3 border-b border-[var(--zc-border)]"
            >
              <div className="flex-1 min-is-0">
                <p className="text-base font-bold truncate">
                  {p.display_name}
                  {p.is_admin ? ' · admin' : ''}
                </p>
                <p className="text-sm text-[var(--zc-muted-foreground)]">
                  joined {joinedFormatted} · {p.locale}
                </p>
              </div>
              <span
                className="text-2xl font-bold tabular-nums"
                dir="ltr"
                aria-label={t('totalPointsLabel')}
              >
                {totalsByUser.get(p.user_id) ?? 0}
              </span>
              {!p.is_admin && (
                <details className="relative">
                  <summary
                    aria-label={`Actions for ${p.display_name}`}
                    className="list-none bs-10 is-10 inline-flex items-center justify-center rounded-xl border border-[var(--zc-border)] text-base text-[var(--zc-muted-foreground)] cursor-pointer hover:bg-[var(--zc-muted)] hover:text-[var(--zc-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--zc-ring)]"
                  >
                    ⋯
                  </summary>
                  <div
                    role="menu"
                    className="absolute inset-bs-12 inset-ie-0 z-40 is-72 bg-[var(--zc-card)] border border-[var(--zc-border)] rounded-2xl shadow-lg pi-3 pbs-3 pbe-3"
                  >
                    <p className="text-xs text-[var(--zc-muted-foreground)] mbe-2">
                      Destructive — moves picks then deletes the source profile.
                    </p>
                    <RosterMergeForm
                      source={{
                        user_id: p.user_id,
                        display_name: p.display_name,
                      }}
                      candidates={candidates}
                    />
                  </div>
                </details>
              )}
            </li>
          );
        })}
      </ul>
    </main>
  );
}
