import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth, ok, err } from '@/lib/api-helpers';
import { gateIn } from '@/lib/stage-machine';

const schema = z.object({
  qrCode: z.string().optional(),
  manualCode: z.string().optional(),
  visitType: z.enum(['FULL_CYCLE', 'OFFLOAD_ONLY', 'LOAD_ONLY']).default('FULL_CYCLE'),
});

export async function POST(req: NextRequest) {
  return withAuth(req, ['GATE_OFFICER', 'ADMIN'], async (session) => {
    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) return err(parsed.error.message);

    const { qrCode, manualCode, visitType } = parsed.data;
    if (!qrCode && !manualCode) return err('qrCode or manualCode is required');

    try {
      const visit = await gateIn({ qrCode, manualCode, visitType, userId: session.userId });
      return ok(visit, 201);
    } catch (e) {
      return err(e instanceof Error ? e.message : 'Gate in failed');
    }
  });
}
