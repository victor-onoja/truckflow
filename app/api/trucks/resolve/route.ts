import { NextRequest } from 'next/server';
import { withAuth, ok, err } from '@/lib/api-helpers';
import prisma from '@/lib/prisma';
import { describeVisit, findTruckByCode, suggestVisitType } from '@/lib/stage-machine';
import { getTargets } from '@/lib/targets-server';

// Scan or type anything that identifies a truck; get back what can happen next.
export async function GET(req: NextRequest) {
  return withAuth(req, [], async () => {
    const code = new URL(req.url).searchParams.get('code') ?? '';
    if (!code.trim()) return err('Scan a QR code or type a plate number');

    const truck = await findTruckByCode(code);
    if (!truck) return err(`No registered truck matches "${code.trim()}"`, 404);

    const active = await prisma.visit.findFirst({
      where: { truckId: truck.id, status: 'ACTIVE' },
      include: { events: true, truck: true },
    });

    return ok({
      truck: { id: truck.id, plateNumber: truck.plateNumber, driverName: truck.driverName },
      activeVisit: active ? describeVisit(active, new Date(), await getTargets()) : null,
      suggestion: active ? null : await suggestVisitType(truck.id),
    });
  });
}
