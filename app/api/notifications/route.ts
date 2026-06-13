import { NextRequest } from 'next/server';
import { withAuth, ok } from '@/lib/api-helpers';
import prisma from '@/lib/prisma';

export async function GET(req: NextRequest) {
  return withAuth(req, [], async (session) => {
    const notifications = await prisma.notification.findMany({
      where: { userId: session.userId, channel: 'IN_APP' },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return ok(notifications);
  });
}

export async function PATCH(req: NextRequest) {
  return withAuth(req, [], async (session) => {
    const body = await req.json().catch(() => ({}));
    const { id } = body as { id?: string };
    const now = new Date();
    if (id) {
      await prisma.notification.updateMany({
        where: { id, userId: session.userId },
        data: { readAt: now },
      });
    } else {
      await prisma.notification.updateMany({
        where: { userId: session.userId, readAt: null },
        data: { readAt: now },
      });
    }
    return ok(null);
  });
}
