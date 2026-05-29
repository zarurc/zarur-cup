'use client';

import { useRef, useState, useTransition } from 'react';
import { updateProfileName } from '@/app/actions/updateProfileName';

type Props = {
  userId: string;
  displayName: string;
  isAdmin: boolean;
};

/**
 * Inline pencil-edit for an admin roster row (R3).
 *
 * Idle: renders [display_name] [· admin]? [pencil button]
 * Editing: renders [text input] [Save] [Cancel]
 *
 * Submit fires the updateProfileName Server Action via a hidden form
 * inside the editing view (so the action can read `target_user_id` +
 * `new_name` from FormData). `useTransition` keeps the Save click
 * non-blocking; the action's revalidatePath + redirect handles the
 * post-save UI.
 *
 * Validation lives server-side (Zod displayNameSchema). The client
 * `minLength=2 maxLength=24` is UX-only.
 */
export function RosterNameEdit({ userId, displayName, isAdmin }: Props) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(displayName);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  const start = () => {
    setValue(displayName);
    setEditing(true);
  };
  const cancel = () => {
    setEditing(false);
    setValue(displayName);
  };
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      await updateProfileName(fd);
    });
  };

  if (!editing) {
    return (
      <p className="text-base font-bold truncate inline-flex items-center gap-2">
        <span>{displayName}{isAdmin ? ' · admin' : ''}</span>
        <button
          type="button"
          onClick={start}
          aria-label={`Edit name for ${displayName}`}
          className="bs-7 is-7 inline-flex items-center justify-center rounded-md text-sm text-[var(--zc-muted-foreground)] hover:bg-[var(--zc-muted)] hover:text-[var(--zc-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--zc-ring)]"
        >
          ✎
        </button>
      </p>
    );
  }

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="inline-flex items-center gap-2"
    >
      <input type="hidden" name="target_user_id" value={userId} />
      <input
        type="text"
        name="new_name"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        minLength={2}
        maxLength={24}
        autoFocus
        required
        aria-label={`New name for ${displayName}`}
        className="bs-9 ps-3 pe-3 rounded-lg border border-[var(--zc-border)] text-base"
      />
      <button
        type="submit"
        disabled={isPending || value.trim() === displayName || value.trim().length < 2}
        className="bs-9 ps-3 pe-3 rounded-lg bg-[var(--zc-primary)] text-[var(--zc-primary-foreground)] font-bold text-sm disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--zc-ring)]"
      >
        {isPending ? 'Saving…' : 'Save'}
      </button>
      <button
        type="button"
        onClick={cancel}
        disabled={isPending}
        className="bs-9 ps-3 pe-3 rounded-lg border border-[var(--zc-border)] text-sm text-[var(--zc-muted-foreground)] hover:text-[var(--zc-primary)] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--zc-ring)]"
      >
        Cancel
      </button>
    </form>
  );
}
