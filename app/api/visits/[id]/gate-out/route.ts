import { NextRequest } from 'next/server';
import { withAuth, ok, err } from '@/lib/api-helpers';
import { gateOut } from '@/lib/stage-machine';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, ['GATE_OFFICER', 'ADMIN'], async (session) => {
    const { id } = await params;
    try {
      const visit = await gateOut({ visitId: id, userId: session.userId, userRole: session.role });
      return ok(visit);
    } catch (e) {
      return err(e instanceof Error ? e.message : 'Failed');
    }
  });
}
