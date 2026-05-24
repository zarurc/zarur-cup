import { NextRequest } from 'next/server';
import createIntlMiddleware from 'next-intl/middleware';
import { routing } from '@/lib/i18n/routing';
import { refreshSupabaseSession } from '@/lib/supabase/middleware';

const intlMiddleware = createIntlMiddleware(routing);

export async function middleware(request: NextRequest) {
  const response = intlMiddleware(request);
  return refreshSupabaseSession(request, response);
}

export const config = {
  // Exclude:
  //   - /api/*       (route handlers handle their own auth)
  //   - /_next/*     (Next.js internals)
  //   - /_vercel/*   (Vercel internals)
  //   - /admin/*     (D-05: admin routes are unlocalized, gated at layout level)
  //   - *.*          (static files)
  matcher: ['/((?!api|_next|_vercel|admin|.*\\..*).*)'],
};
