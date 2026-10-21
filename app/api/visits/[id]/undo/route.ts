import { NextRequest } from 'next/server';
import { withAuth, ok, err } from '@/lib/api-helpers';
import { undoLast } from '@/lib/stage-machine';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, ['GATE_OFFICER', 'FORKLIFT_OPERATOR', 'FUELING_STAFF', 'ADMIN'], async (session) => {
    const { id } = await params;
    try {
      return ok(await undoLast({ visitId: id, userId: session.userId }));
    } catch (e) {
      return err(e instanceof Error ? e.message : 'Undo failed', 409);
    }
  });
}
