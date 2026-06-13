import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, SessionPayload } from './auth';

export type RouteContext = { session: SessionPayload };

export function ok(data: unknown, status = 200) {
  return NextResponse.json({ ok: true, data }, { status });
}

export function err(error: string, status = 400) {
  return NextResponse.json({ ok: false, error }, { status });
}

export async function withAuth(
  req: NextRequest,
  roles: string[],
  handler: (session: SessionPayload) => Promise<NextResponse>
): Promise<NextResponse> {
  const session = await getSessionFromRequest(req);
  if (!session) return err('Unauthorized', 401);
  if (roles.length > 0 && !roles.includes(session.role)) return err('Forbidden', 403);
  try {
    return await handler(session);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Internal error';
    return err(msg, 500);
  }
}
