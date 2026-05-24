import { Wordmark } from './Wordmark';
import { LocaleTogglePill } from './LocaleTogglePill.client';

/**
 * Sticky top header per UI-SPEC §2:
 *   - 56px tall (bs-14), fixed at the top, full-width
 *   - Wordmark on the inline-start side, locale pill on inline-end
 *   - <html dir> auto-flips the visual order; never reverse the flex row
 *     manually - let the inline axis do the work.
 */
export function Header() {
  return (
    <header className="fixed inset-bs-0 inset-i-0 z-40 bs-14 bg-[var(--zc-card)] border-b-1 border-[var(--zc-border)]">
      <div className="bs-full flex items-center justify-between ps-4 pe-4">
        <Wordmark />
        <LocaleTogglePill />
      </div>
    </header>
  );
}
