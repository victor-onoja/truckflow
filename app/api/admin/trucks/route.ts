import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth, ok, err } from '@/lib/api-helpers';
import prisma from '@/lib/prisma';

const schema = z.object({
  plateNumber: z.string().min(3),
  driverName: z.string().min(2),
});

export async function POST(req: NextRequest) {
  return withAuth(req, ['ADMIN'], async () => {
    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) return err(parsed.error.message);

    const { plateNumber, driverName } = parsed.data;
    const codeString = `TF-${plateNumber}`;

    try {
      const truck = await prisma.truck.create({
        data: {
          plateNumber,
          driverName,
          qrCodes: { create: { codeString, type: 'PERMANENT' } },
        },
        include: { qrCodes: true },
      });
      return ok(truck, 201);
    } catch (e) {
      return err(e instanceof Error ? e.message : 'Failed to create truck');
    }
  });
}

export async function GET(req: NextRequest) {
  return withAuth(req, ['ADMIN'], async () => {
    const trucks = await prisma.truck.findMany({
      include: { qrCodes: { where: { type: 'PERMANENT', isActive: true } } },
      orderBy: { plateNumber: 'asc' },
    });
    return ok(trucks);
  });
}
