import { NextRequest } from 'next/server';
import { withAuth, ok } from '@/lib/api-helpers';
import prisma from '@/lib/prisma';
import { queuingDuration } from '@/lib/stage-machine';

export async function GET(req: NextRequest) {
  return withAuth(req, ['SUPERVISOR', 'DISTRIBUTION_LEAD', 'ADMIN'], async () => {
    const { searchParams } = new URL(req.url);
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const truckId = searchParams.get('truckId');
    const visitType = searchParams.get('visitType');

    const visits = await prisma.visit.findMany({
      where: {
        status: 'COMPLETED',
        ...(dateFrom && { gateInAt: { gte: new Date(dateFrom) } }),
        ...(dateTo && { gateInAt: { lte: new Date(dateTo) } }),
        ...(truckId && { truckId }),
        ...(visitType && { visitType: visitType as never }),
      },
      orderBy: { gateOutAt: 'desc' },
      include: { truck: true, events: true },
    });

    return ok(visits.map((v) => ({ ...v, queuingMinutes: queuingDuration(v) })));
  });
}
