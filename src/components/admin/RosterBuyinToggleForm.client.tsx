'use client';

import { toggleBuyinPaid } from '@/app/actions/toggleBuyinPaid';

type Props = {
  targetUserId: string;
  isPaid: boolean;
};

/**
 * Tiny paid/unpaid toggle button for the roster overflow menu.
 * No confirmation — flipping is reversible.
 */
export function RosterBuyinToggleForm({ targetUserId, isPaid }: Props) {
  return (
    <form action={toggleBuyinPaid}>
      <input type="hidden" name="target_user_id" value={targetUserId} />
      <input type="hidden" name="paid" value={isPaid ? 'false' : 'true'} />
      <button
        type="submit"
        className={
          isPaid
            ? 'is-full bs-10 ps-3 pe-3 rounded-xl border border-[var(--zc-border)] text-[var(--zc-muted-foreground)] font-bold text-sm hover:bg-[var(--zc-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--zc-ring)]'
            : 'is-full bs-10 ps-3 pe-3 rounded-xl bg-[var(--zc-accent)] text-[var(--zc-primary-foreground)] font-bold text-sm hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--zc-ring)]'
        }
      >
        {isPaid ? 'Mark unpaid' : 'Mark paid'}
      </button>
    </form>
  );
}
