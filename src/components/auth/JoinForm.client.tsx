'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { useTranslations } from 'next-intl';
import { joinPool, type JoinState } from '@/app/actions/join';
import { FormField } from '@/components/ui/FormField';

function SubmitButton() {
  const { pending } = useFormStatus();
  const t = useTranslations('join');
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className="bs-12 is-full bg-[--zc-primary] text-[--zc-primary-foreground] rounded-xl font-bold text-base hover:bg-[#13325a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--zc-ring] focus-visible:ring-offset-2 focus-visible:ring-offset-[--zc-card] disabled:opacity-80"
    >
      {pending ? t('submitLoading') : t('submitIdle')}
    </button>
  );
}

/**
 * Client-side form for /[locale]/join. Uses useActionState for the Server
 * Action round-trip so inline errors don't require a JSON API.
 *
 * Errors are normalized into a per-field error string via errorMessageFor() so
 * the FormField wrapper handles the visual state (border swap + aria-live
 * region under the field).
 */
export function JoinForm() {
  const t = useTranslations('join');
  const [state, formAction] = useActionState<JoinState, FormData>(
    joinPool,
    null,
  );

  function errorMessageFor(
    field: 'display_name' | 'invite_code',
  ): string | undefined {
    if (!state) return undefined;
    // Top-level errors that apply to a known field.
    if (field === 'invite_code' && state.error === 'invalid_code') {
      return t('errors.invalid_code');
    }
    if (field === 'display_name' && state.error === 'display_name_taken') {
      return t('errors.display_name_taken');
    }
    // Zod issue codes -> map by path + code.
    if (state.error === 'validation_failed' && state.issues) {
      const match = state.issues.find((i) => i.path === field);
      if (match) {
        if (match.code === 'name_length') return t('errors.name_length');
        if (match.code === 'name_chars') return t('errors.name_chars');
        if (match.code === 'invalid_code') return t('errors.invalid_code');
      }
    }
    return undefined;
  }

  // Non-field-specific errors render in a single bottom paragraph above the
  // submit button.
  const formError =
    state?.error === 'auth_failed' || state?.error === 'profile_failed'
      ? t('errors.auth_failed')
      : undefined;

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <FormField
        id="display_name"
        name="display_name"
        label={t('nameLabel')}
        helper={t('nameHelper')}
        placeholder={t('namePlaceholder')}
        autoComplete="username"
        required
        error={errorMessageFor('display_name')}
      />
      <FormField
        id="invite_code"
        name="invite_code"
        label={t('codeLabel')}
        helper={t('codeHelper')}
        autoComplete="off"
        required
        error={errorMessageFor('invite_code')}
      />
      {formError && (
        <p
          className="text-sm text-[--zc-destructive]"
          aria-live="polite"
        >
          {formError}
        </p>
      )}
      <SubmitButton />
    </form>
  );
}
