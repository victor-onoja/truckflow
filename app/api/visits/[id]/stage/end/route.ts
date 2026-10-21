import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth, ok, err } from '@/lib/api-helpers';
import { endStage } from '@/lib/stage-machine';
import { StageKey } from '@/lib/stages';

const schema = z.object({
  stageKey: z.string(),
  notes: z.string().optional(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, ['FORKLIFT_OPERATOR', 'FUELING_STAFF', 'ADMIN'], async (session) => {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) return err(parsed.error.message);

    try {
      const event = await endStage({
        visitId: id,
        stageKey: parsed.data.stageKey as StageKey,
        userId: session.userId,
        userRole: session.role,
        notes: parsed.data.notes,
      });
      return ok(event);
    } catch (e) {
      return err(e instanceof Error ? e.message : 'Failed');
    }
  });
}
