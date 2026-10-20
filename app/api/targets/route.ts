import { NextRequest } from 'next/server';
import { withAuth, ok } from '@/lib/api-helpers';
import { getTargets } from '@/lib/targets-server';

export async function GET(req: NextRequest) {
  return withAuth(req, [], async () => ok(await getTargets()));
}
