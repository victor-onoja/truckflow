import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from './lib/auth';

const PUBLIC = ['/login', '/api/auth/login'];

export async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;

  if (PUBLIC.some((p) => path.startsWith(p))) return NextResponse.next();
  if (path.startsWith('/_next') || path.startsWith('/favicon')) return NextResponse.next();

  const session = await getSessionFromRequest(req);
  if (!session) {
    if (path.startsWith('/api/')) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/login', req.url));
  }

  return NextResponse.next();
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
