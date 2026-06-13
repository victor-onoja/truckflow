import { NextRequest } from 'next/server';
import { withAuth, ok } from '@/lib/api-helpers';
import prisma from '@/lib/prisma';
import { currentStage, queuingDuration } from '@/lib/stage-machine';
import { STAGES } from '@/lib/stages';

export async function GET(req: NextRequest) {
  return withAuth(req, [], async () => {
    const visits = await prisma.visit.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { gateInAt: 'asc' },
      include: { truck: true, events: true },
    });

    const now = new Date();
    const data = visits.map((v, i) => {
      const stage = currentStage(v);
      const stageEvent = v.events.find((e) => e.stageKey === stage);
      const elapsedInStage = stageEvent?.startAt
        ? Math.round((now.getTime() - stageEvent.startAt.getTime()) / 60000)
        : null;
      const totalElapsed = Math.round((now.getTime() - v.gateInAt.getTime()) / 60000);
      const queuing = queuingDuration(v);

      return {
        id: v.id,
        truckPlate: v.truck.plateNumber,
        driverName: v.truck.driverName,
        visitType: v.visitType,
        currentStage: stage,
        currentStageName: STAGES[stage].name,
        elapsedInStage,
        totalElapsed,
        queuingMinutes: queuing,
        gateInAt: v.gateInAt,
        queuePosition: i + 1,
      };
    });

    return ok(data);
  });
}
