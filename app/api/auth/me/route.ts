import { NextRequest } from 'next/server';
import { withAuth, ok } from '@/lib/api-helpers';

export async function GET(req: NextRequest) {
  return withAuth(req, [], async (session) => ok(session));
}
