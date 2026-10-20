import { NextRequest } from 'next/server';
import { withAuth, ok, err } from '@/lib/api-helpers';
import prisma from '@/lib/prisma';
import { describeVisit } from '@/lib/stage-machine';
import { VISIT_SEQUENCES, STAGES } from '@/lib/stages';
import { getTargets } from '@/lib/targets-server';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, [], async () => {
    const { id } = await params;
    const visit = await prisma.visit.findUnique({
      where: { id },
      include: {
        truck: true,
        events: { orderBy: { stageNum: 'asc' }, include: { triggeredBy: { select: { fullName: true } } } },
      },
    });
    if (!visit) return err('Visit not found', 404);

    const sequence = VISIT_SEQUENCES[visit.visitType].map((key) => {
      const e = visit.events.find((ev) => ev.stageKey === key);
      return {
        key,
        name: STAGES[key].name,
        num: STAGES[key].num,
        capture: STAGES[key].capture,
        event: e
          ? {
              startAt: e.startAt,
              endAt: e.endAt,
              durationMinutes: e.durationMinutes,
              notes: e.notes,
              by: e.triggeredBy.fullName,
            }
          : null,
      };
    });

    return ok({ ...describeVisit(visit, new Date(), await getTargets()), gateOutAt: visit.gateOutAt, sequence });
  });
}
