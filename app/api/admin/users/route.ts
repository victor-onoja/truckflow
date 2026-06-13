import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth, ok, err } from '@/lib/api-helpers';
import prisma from '@/lib/prisma';
import { hashPin } from '@/lib/auth';

const schema = z.object({
  phone: z.string().min(10),
  pin: z.string().length(4),
  fullName: z.string().min(2),
  role: z.enum(['GATE_OFFICER', 'YARD_OPERATOR', 'FUELING_STAFF', 'SUPERVISOR', 'DISTRIBUTION_LEAD', 'ADMIN']),
});

export async function POST(req: NextRequest) {
  return withAuth(req, ['ADMIN'], async () => {
    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) return err(parsed.error.message);

    const { phone, pin, fullName, role } = parsed.data;
    const pinHash = await hashPin(pin);

    try {
      const user = await prisma.user.create({ data: { phone, pinHash, fullName, role } });
      return ok({ id: user.id, phone: user.phone, fullName: user.fullName, role: user.role }, 201);
    } catch (e) {
      return err(e instanceof Error ? e.message : 'Failed to create user');
    }
  });
}

export async function GET(req: NextRequest) {
  return withAuth(req, ['ADMIN'], async () => {
    const users = await prisma.user.findMany({
      select: { id: true, phone: true, fullName: true, role: true, isActive: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
    return ok(users);
  });
}
