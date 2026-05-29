import { adminReadClient } from '@/lib/auth/adminReadClient';
import { getCurrentMember } from '@/lib/auth/session';
import { getTranslations } from 'next-intl/server';
import { RosterMergeForm } from '@/components/admin/RosterMergeForm.client';
import { RosterNameEdit } from '@/components/admin/RosterNameEdit.client';
import { RosterAdminToggleForm } from '@/components/admin/RosterAdminToggleForm.client';
import { RosterBuyinToggleForm } from '@/components/admin/RosterBuyinToggleForm.client';
import { AdminToast } from '@/components/admin/AdminToast.client';
import { resolveAdminToast } from '@/lib/admin/toast';

/**
 * /admin/roster — family roster + admin tools (ADM-05 + D-14 + R3 + R4).
 *
 * Reads every profile via adminReadClient (Pitfall 10 — service-role
 * sees all rows; the anon-RLS path would only return the admin's own
 * row, defeating the purpose of a roster page).
 *
 * Each row offers:
 *   - Inline rename via the ✎ pencil button next to the name (R3 —
 *     RosterNameEdit + updateProfileName Server Action).
 *   - An overflow ⋯ menu containing:
 *       • Merge form (non-admin rows only — admin → admin merges are
 *         blocked by omission as a defense against bricking admin
 *         access; the Server Action additionally refines).
 *       • Promote/Demote button (R4 — RosterAdminToggleForm +
 *         toggleProfileAdmin). Always rendered, even on admin rows,
 *         because R4 is the only place to demote an admin in-app.
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
  const currentMember = await getCurrentMember();
  const currentUserId = currentMember?.user_id ?? null;

  const { data: profiles } = await svc
    .from('profiles')
    .select('user_id, display_name, joined_at, locale, is_admin, buyin_paid_at')
    .order('joined_at', { ascending: true });

  const { data: tournament } = await svc
    .from('tournament')
    .select('buyin_amount_usd')
    .eq('code', 'WC2026')
    .maybeSingle();
  const buyinAmount = tournament?.buyin_amount_usd ?? 0;

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
      {buyinAmount > 0 && (() => {
        const paidCount = profileList.filter((p) => p.buyin_paid_at).length;
        const pendingCount = profileList.length - paidCount;
        const potUsd = paidCount * buyinAmount;
        return (
          <div className="mbe-4 ps-4 pe-4 pbs-3 pbe-3 rounded-xl border border-[var(--zc-border)] bg-[var(--zc-card)] flex items-center justify-between gap-3">
            <div>
              <p className="text-xs text-[var(--zc-muted-foreground)]">
                Buy-in ${buyinAmount} / user
              </p>
              <p className="text-base font-bold">
                Pot: ${potUsd} · {paidCount} paid · {pendingCount} pending
              </p>
            </div>
          </div>
        );
      })()}
      <ul>
        {profileList.map((p) => {
          const joinedFormatted = new Intl.DateTimeFormat('en-US', {
            dateStyle: 'medium',
          }).format(new Date(p.joined_at));
          const isSelf = currentUserId === p.user_id;
          return (
            <li
              key={p.user_id}
              className="flex items-center justify-between gap-3 pbs-3 pbe-3 border-b border-[var(--zc-border)]"
            >
              <div className="flex-1 min-is-0">
                <RosterNameEdit
                  userId={p.user_id}
                  displayName={p.display_name}
                  isAdmin={p.is_admin}
                />
                <p className="text-sm text-[var(--zc-muted-foreground)]">
                  joined {joinedFormatted} · {p.locale}
                  {buyinAmount > 0 && (
                    <>
                      {' · '}
                      <span
                        className={
                          p.buyin_paid_at
                            ? 'text-[var(--zc-primary)] font-bold'
                            : 'text-[var(--zc-destructive)] font-bold'
                        }
                      >
                        {p.buyin_paid_at ? `paid $${buyinAmount}` : `unpaid $${buyinAmount}`}
                      </span>
                    </>
                  )}
                </p>
              </div>
              <span
                className="text-2xl font-bold tabular-nums"
                dir="ltr"
                aria-label={t('totalPointsLabel')}
              >
                {totalsByUser.get(p.user_id) ?? 0}
              </span>
              <details className="relative">
                <summary
                  aria-label={`Actions for ${p.display_name}`}
                  className="list-none bs-10 is-10 inline-flex items-center justify-center rounded-xl border border-[var(--zc-border)] text-base text-[var(--zc-muted-foreground)] cursor-pointer hover:bg-[var(--zc-muted)] hover:text-[var(--zc-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--zc-ring)]"
                >
                  ⋯
                </summary>
                <div
                  role="menu"
                  className="absolute inset-bs-12 inset-ie-0 z-40 is-72 bg-[var(--zc-card)] border border-[var(--zc-border)] rounded-2xl shadow-lg pi-3 pbs-3 pbe-3 space-y-3"
                >
                  {buyinAmount > 0 && (
                    <div>
                      <p className="text-xs text-[var(--zc-muted-foreground)] mbe-2">
                        Flip when you receive the ${buyinAmount} buy-in via Bit / Venmo / cash.
                      </p>
                      <RosterBuyinToggleForm
                        targetUserId={p.user_id}
                        isPaid={Boolean(p.buyin_paid_at)}
                      />
                    </div>
                  )}
                  <div className={buyinAmount > 0 ? 'border-t border-[var(--zc-border)] pbs-3' : ''}>
                    <p className="text-xs text-[var(--zc-muted-foreground)] mbe-2">
                      {p.is_admin
                        ? 'Admins have access to /admin. Demote with care — last admin is blocked server-side.'
                        : 'Promote to grant /admin access.'}
                    </p>
                    <RosterAdminToggleForm
                      targetUserId={p.user_id}
                      targetDisplayName={p.display_name}
                      isAdmin={p.is_admin}
                      isSelf={isSelf}
                    />
                  </div>
                  {!p.is_admin && (
                    <div className="border-t border-[var(--zc-border)] pbs-3">
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
                  )}
                </div>
              </details>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
