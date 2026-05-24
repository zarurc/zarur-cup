type Props = {
  id: string;
  name: string;
  label: string;
  helper?: string;
  placeholder?: string;
  type?: 'text' | 'password';
  autoComplete?: string;
  required?: boolean;
  defaultValue?: string;
  error?: string;
};

/**
 * Single-line text input wrapper per UI-SPEC §6 "Form Field".
 *
 * - 48px tall input with focus ring (accent yellow) + accent-yellow border
 *   replacement on focus.
 * - Error state replaces the default border with destructive red and adds an
 *   aria-live="polite" error region under the input.
 * - All spacing uses logical-property utilities (FND-03).
 */
export function FormField({
  id,
  name,
  label,
  helper,
  placeholder,
  type = 'text',
  autoComplete,
  required,
  defaultValue,
  error,
}: Props) {
  const helperId = helper ? `${id}-helper` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy =
    [helperId, errorId].filter(Boolean).join(' ') || undefined;
  const borderClass = error
    ? 'border-[--zc-destructive]'
    : 'border-[--zc-border] focus-visible:border-[--zc-accent]';
  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor={id}
        className="text-sm font-bold text-[--zc-primary]"
      >
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        autoComplete={autoComplete}
        placeholder={placeholder}
        defaultValue={defaultValue}
        required={required}
        aria-describedby={describedBy}
        aria-invalid={error ? true : undefined}
        className={`bs-12 is-full bg-white rounded-xl border ${borderClass} ps-4 pe-4 text-base text-[--zc-primary] placeholder:text-[--zc-muted-foreground] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--zc-ring] focus-visible:ring-offset-2 focus-visible:ring-offset-[--zc-card]`}
      />
      {helper && (
        <p id={helperId} className="text-sm text-[--zc-muted-foreground]">
          {helper}
        </p>
      )}
      {error && (
        <p
          id={errorId}
          className="text-sm text-[--zc-destructive]"
          aria-live="polite"
        >
          {error}
        </p>
      )}
    </div>
  );
}
