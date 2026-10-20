import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from './lib/auth';
import { canOpenPage, homeFor } from './lib/access';

const PUBLIC = ['/login', '/api/auth/login'];

export async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;

  if (PUBLIC.some((p) => path.startsWith(p))) return NextResponse.next();
  if (path.startsWith('/_next') || /^\/(favicon|icon|apple-icon)/.test(path)) return NextResponse.next();

  const session = await getSessionFromRequest(req);
  if (!session) {
    if (path.startsWith('/api/')) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/login', req.url));
  }

  // API routes enforce roles themselves via withAuth; pages are gated here.
  if (!path.startsWith('/api/') && !canOpenPage(path, session.role)) {
    return NextResponse.redirect(new URL(homeFor(session.role), req.url));
  }

  return NextResponse.next();
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|icon|apple-icon).*)'] };
