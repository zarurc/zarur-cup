'use client';

import type { FormEvent } from 'react';
import { toggleProfileAdmin } from '@/app/actions/toggleProfileAdmin';

type Props = {
  targetUserId: string;
  targetDisplayName: string;
  isAdmin: boolean;
  isSelf: boolean;
};

/**
 * Promote / demote button for the roster overflow menu (R4).
 *
 * - Non-admin row → button reads "Make admin" (no confirm).
 * - Admin row    → button reads "Remove admin". window.confirm() is
 *   the friction layer; self-demote gets an explicit "you'll lose
 *   admin access immediately" warning per the design call.
 *
 * The Server Action enforces the last-admin guard server-side; the
 * client confirm is purely UX.
 */
export function RosterAdminToggleForm({
  targetUserId,
  targetDisplayName,
  isAdmin,
  isSelf,
}: Props) {
  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    if (!isAdmin) return; // Promote needs no confirmation.
    const msg = isSelf
      ? "You will lose admin access immediately. Continue?"
      : `Remove admin from ${targetDisplayName}?`;
    if (!window.confirm(msg)) e.preventDefault();
  };

  return (
    <form action={toggleProfileAdmin} onSubmit={handleSubmit}>
      <input type="hidden" name="target_user_id" value={targetUserId} />
      <input
        type="hidden"
        name="make_admin"
        value={isAdmin ? 'false' : 'true'}
      />
      <button
        type="submit"
        className={
          isAdmin
            ? 'is-full bs-10 ps-3 pe-3 rounded-xl border border-[var(--zc-destructive)] text-[var(--zc-destructive)] font-bold text-sm hover:bg-[var(--zc-destructive)] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--zc-ring)]'
            : 'is-full bs-10 ps-3 pe-3 rounded-xl bg-[var(--zc-primary)] text-[var(--zc-primary-foreground)] font-bold text-sm hover:bg-[#13325a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--zc-ring)]'
        }
      >
        {isAdmin ? 'Remove admin' : 'Make admin'}
      </button>
    </form>
  );
}
