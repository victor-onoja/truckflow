import { NextRequest } from 'next/server';
import { withAuth, ok } from '@/lib/api-helpers';
import prisma from '@/lib/prisma';
import { describeVisit } from '@/lib/stage-machine';
import { getTargets } from '@/lib/targets-server';

// Headline numbers for today, independent of any history filters.
export async function GET(req: NextRequest) {
  return withAuth(req, ['SUPERVISOR', 'ADMIN'], async () => {
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);

    const [active, doneToday] = await Promise.all([
      prisma.visit.findMany({ where: { status: 'ACTIVE' }, include: { events: true, truck: true } }),
      prisma.visit.findMany({ where: { status: 'COMPLETED', gateOutAt: { gte: startOfDay } }, select: { totalMinutes: true } }),
    ]);

    const targets = await getTargets();
    const summaries = active.map((v) => describeVisit(v, now, targets));
    const times = doneToday.map((v) => v.totalMinutes).filter((m): m is number => m != null);

    return ok({
      onSite: active.length,
      overdue: summaries.filter((s) => s.health === 'over').length,
      runningLong: summaries.filter((s) => s.health === 'warn').length,
      overTct: summaries.filter((s) => s.tct?.health === 'over').length,
      completedToday: doneToday.length,
      avgTurnaroundToday: times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : null,
    });
  });
}
