import { NextRequest } from 'next/server';
import { withAuth, ok, err } from '@/lib/api-helpers';
import prisma from '@/lib/prisma';
import { currentStage, queuingDuration, isGateOutReady } from '@/lib/stage-machine';
import { VISIT_SEQUENCES, STAGES } from '@/lib/stages';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, [], async () => {
    const { id } = await params;
    const visit = await prisma.visit.findUnique({
      where: { id },
      include: { truck: true, events: { orderBy: { stageNum: 'asc' } } },
    });
    if (!visit) return err('Visit not found', 404);

    const queuing = queuingDuration(visit);
    const stage = currentStage(visit);
    const gateOutReady = isGateOutReady(visit);

    const sequence = VISIT_SEQUENCES[visit.visitType].map((key) => ({
      key,
      name: STAGES[key].name,
      num: STAGES[key].num,
      capture: STAGES[key].capture,
      event: visit.events.find((e) => e.stageKey === key) ?? null,
    }));

    return ok({ ...visit, queuingMinutes: queuing, currentStage: stage, gateOutReady, sequence });
  });
}
