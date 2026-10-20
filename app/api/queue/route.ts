import { NextRequest } from 'next/server';
import { withAuth, ok } from '@/lib/api-helpers';
import prisma from '@/lib/prisma';
import { describeVisit } from '@/lib/stage-machine';
import { checkDelays } from '@/lib/alerts';
import { getTargets } from '@/lib/targets-server';

export async function GET(req: NextRequest) {
  return withAuth(req, [], async () => {
    const now = new Date();
    // Delay alerts ride on queue polling; failures must never break the queue.
    checkDelays(now).catch((e) => console.error('[alerts]', e));

    const targets = await getTargets();
    const visits = await prisma.visit.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { gateInAt: 'asc' },
      include: { truck: true, events: true },
    });

    return ok(visits.map((v, i) => ({ ...describeVisit(v, now, targets), queuePosition: i + 1 })));
  });
}
