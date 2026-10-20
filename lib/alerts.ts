import prisma from './prisma';
import { describeVisit } from './stage-machine';
import { getTargets } from './targets-server';
import { fmtMinutes } from './client-types';

const CHECK_EVERY_MS = 60_000;
let lastCheck = 0;

/**
 * Notify supervisors once when a truck goes past the limit for its current
 * step, or past its whole-visit TCT limit (limits are admin-editable). Runs
 * piggy-backed on queue polling (throttled to once a minute), so it needs no
 * separate scheduler in V1.
 */
export async function checkDelays(now = new Date()) {
  if (now.getTime() - lastCheck < CHECK_EVERY_MS) return;
  lastCheck = now.getTime();

  const visits = await prisma.visit.findMany({
    where: { status: 'ACTIVE' },
    include: { events: true, truck: true },
  });
  const targets = await getTargets();
  const summaries = visits.map((v) => describeVisit(v, now, targets));

  // One alert per truck per reason: a stage past its limit, or the whole visit past its TCT limit.
  const alerts = [
    ...summaries
      .filter((s) => s.health === 'over')
      .map((s) => ({
        s,
        title: `Delay: ${s.truckPlate} · ${s.statusLabel}`,
        body: `${s.truckPlate} has been at ${s.statusLabel.toLowerCase()} for ${s.minutesInStep} min, past the ${s.statusLabel.toLowerCase()} limit.`,
      })),
    ...summaries
      .filter((s) => s.tct?.health === 'over')
      .map((s) => ({
        s,
        title: `Delay: ${s.truckPlate} · over TCT limit`,
        body: `${s.truckPlate} has been in the plant for ${fmtMinutes(s.totalElapsed)}, past the ${fmtMinutes(s.tct!.limit)} TCT limit.`,
      })),
  ];
  if (alerts.length === 0) return;

  const recipients = await prisma.user.findMany({
    where: { role: { in: ['SUPERVISOR', 'DISTRIBUTION_LEAD'] }, isActive: true },
    select: { id: true },
  });

  for (const { s, title, body } of alerts) {
    const already = await prisma.notification.findFirst({ where: { visitId: s.id, title } });
    if (already) continue;
    await prisma.notification.createMany({
      data: recipients.map((u) => ({ userId: u.id, channel: 'IN_APP' as const, title, body, visitId: s.id })),
    });
  }
}
