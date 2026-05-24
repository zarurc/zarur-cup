import { NextRequest } from 'next/server';
import createIntlMiddleware from 'next-intl/middleware';
import { routing } from '@/lib/i18n/routing';
import { refreshSupabaseSession } from '@/lib/supabase/middleware';

const intlMiddleware = createIntlMiddleware(routing);

export async function middleware(request: NextRequest) {
  // Surface the request pathname to RSCs via a request header (mutating the
  // request headers before middleware chains makes Next forward the header to
  // downstream server components). The bottom tab bar reads this via
  // headers() to highlight the active tab without becoming a client component.
  request.headers.set('x-pathname', request.nextUrl.pathname);
  const response = intlMiddleware(request);
  // Mirror it onto the response so it's also readable from the response side
  // (defense in depth - some intl-middleware redirect paths reconstruct the
  // request).
  response.headers.set('x-pathname', request.nextUrl.pathname);
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
