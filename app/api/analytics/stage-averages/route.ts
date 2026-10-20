import { NextRequest } from 'next/server';
import { withAuth, ok, dateRange } from '@/lib/api-helpers';
import prisma from '@/lib/prisma';

export async function GET(req: NextRequest) {
  return withAuth(req, ['SUPERVISOR', 'DISTRIBUTION_LEAD', 'ADMIN'], async () => {
    const { searchParams } = new URL(req.url);
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    const visits = await prisma.visit.findMany({
      where: {
        status: 'COMPLETED',
        gateInAt: dateRange(dateFrom, dateTo),
      },
      include: { events: true },
    });

    // Group averages by visitType then stageKey
    const map: Record<string, Record<string, number[]>> = {};
    for (const v of visits) {
      if (!map[v.visitType]) map[v.visitType] = {};
      if (v.totalMinutes != null) (map[v.visitType].TCT ??= []).push(v.totalMinutes);
      for (const e of v.events) {
        if (e.durationMinutes == null) continue;
        if (!map[v.visitType][e.stageKey]) map[v.visitType][e.stageKey] = [];
        map[v.visitType][e.stageKey].push(e.durationMinutes);
      }
    }

    const result: Record<string, Record<string, number | null>> = {};
    for (const [vt, stages] of Object.entries(map)) {
      result[vt] = {};
      for (const [sk, durations] of Object.entries(stages)) {
        result[vt][sk] = durations.length
          ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
          : null;
      }
    }

    return ok(result);
  });
}
