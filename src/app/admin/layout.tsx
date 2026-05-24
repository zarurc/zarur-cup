import { Inter } from 'next/font/google';
import '../globals.css';

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-inter',
});

/**
 * Outer admin layout - English-only (D-05), no locale prefix, no chrome.
 *
 * NO admin gate here. The actual gate lives in the (protected) route
 * group's layout. This outer layout MUST be gate-less so that /admin/403 -
 * which sits outside the (protected) group - can render without entering a
 * redirect loop (T-04-09).
 */
export default function AdminOuterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" dir="ltr" className={inter.variable}>
      <body className="font-inter min-bs-dvh bg-[--zc-surface] text-[--zc-surface-foreground]">
        {children}
      </body>
    </html>
  );
}
