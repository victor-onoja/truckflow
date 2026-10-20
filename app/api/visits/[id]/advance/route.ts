import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth, ok, err } from '@/lib/api-helpers';
import { advance } from '@/lib/stage-machine';

const schema = z.object({
  expect: z.object({ kind: z.string(), stageKey: z.string().optional() }).optional(),
  notes: z.string().max(500).optional(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, ['GATE_OFFICER', 'YARD_OPERATOR', 'FUELING_STAFF', 'ADMIN'], async (session) => {
    const { id } = await params;
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return err(parsed.error.message);

    try {
      const result = await advance({
        visitId: id,
        userId: session.userId,
        userRole: session.role,
        expect: parsed.data.expect,
        notes: parsed.data.notes?.trim() || undefined,
      });
      return ok(result);
    } catch (e) {
      return err(e instanceof Error ? e.message : 'Failed', 409);
    }
  });
}
