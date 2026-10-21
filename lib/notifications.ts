import prisma from './prisma';

export type NotifChannel = 'IN_APP' | 'EMAIL' | 'SMS';

export interface NotificationProvider {
  send(n: {
    userId: string;
    channel: NotifChannel;
    title: string;
    body: string;
    visitId?: string;
  }): Promise<void>;
}

const inApp: NotificationProvider = {
  async send({ userId, title, body, visitId }) {
    await prisma.notification.create({
      data: { userId, channel: 'IN_APP', title, body, visitId },
    });
  },
};

const emailStub: NotificationProvider = {
  async send({ userId, title, body, visitId }) {
    console.log(`[EMAIL STUB] to userId=${userId} | ${title}: ${body} | visitId=${visitId}`);
    await prisma.notification.create({
      data: { userId, channel: 'EMAIL', title, body, visitId },
    });
  },
};

type VisitWithTruck = {
  id: string;
  visitType: string;
  gateOutAt: Date | null;
  totalMinutes: number | null;
  truck: { plateNumber: string };
};

function fmt(d: Date | null): string {
  if (!d) return 'N/A';
  return d.toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' });
}

export async function notifyGateOut(visit: VisitWithTruck) {
  const recipients = await prisma.user.findMany({
    where: { role: 'SUPERVISOR', isActive: true },
  });
  const body = `${visit.truck.plateNumber} (${visit.visitType}) gated out at ${fmt(visit.gateOutAt)}. Total: ${visit.totalMinutes ?? '?'} min.`;
  await Promise.all(
    recipients.flatMap((u) => [
      inApp.send({ userId: u.id, channel: 'IN_APP', title: 'Truck Gate Out', body, visitId: visit.id }),
      emailStub.send({ userId: u.id, channel: 'EMAIL', title: 'Truck Gate Out', body, visitId: visit.id }),
    ])
  );
}
