import prisma from './prisma';
import { VISIT_SEQUENCES, STAGES, getActionableStages, STAGE_ROLE_PERMISSIONS, diffMinutes, StageKey, VisitType } from './stages';
import { notifyGateOut } from './notifications';
import { Prisma } from '@prisma/client';

type VisitWithEvents = Prisma.VisitGetPayload<{ include: { events: true; truck: true } }>;

function findEvent(visit: VisitWithEvents, key: StageKey) {
  return visit.events.find((e) => e.stageKey === key) ?? null;
}

export function queuingDuration(visit: VisitWithEvents): number | null {
  const gateIn = findEvent(visit, 'GATE_IN')?.startAt;
  const firstPostQueue = visit.visitType === 'LOAD_ONLY' ? 'LOADING' : 'UNLATCHING';
  const start = findEvent(visit, firstPostQueue)?.startAt;
  return gateIn && start ? diffMinutes(gateIn, start) : null;
}

export function currentStage(visit: VisitWithEvents): StageKey {
  const seq = VISIT_SEQUENCES[visit.visitType as VisitType];
  const actionable = seq.filter((k) => STAGES[k].capture === 'START_END');

  // If gate out recorded
  if (findEvent(visit, 'GATE_OUT')) return 'GATE_OUT';

  // Walk actionable stages; find the in-progress or next
  for (const key of actionable) {
    const ev = findEvent(visit, key);
    if (!ev) return key; // not started
    if (ev.startAt && !ev.endAt) return key; // in progress
  }

  // All actionable stages ended
  return 'GATE_OUT';
}

export function isGateOutReady(visit: VisitWithEvents): boolean {
  const actionable = getActionableStages(visit.visitType as VisitType);
  return actionable.every((k) => {
    const ev = findEvent(visit, k);
    return ev?.endAt != null;
  });
}

// ─── gateIn ─────────────────────────────────────────────────────────────────

export async function gateIn(opts: {
  truckId?: string;
  qrCode?: string;
  manualCode?: string;
  visitType: VisitType;
  userId: string;
}) {
  const { visitType, userId } = opts;
  const now = new Date();

  // Resolve truck
  let truckId = opts.truckId;
  if (!truckId) {
    const code = opts.qrCode ?? opts.manualCode;
    if (!code) throw new Error('Must provide truckId, qrCode, or manualCode');
    const qr = await prisma.qRCode.findUnique({
      where: { codeString: code },
      include: { truck: true },
    });
    if (!qr || !qr.isActive) throw new Error('QR code not found or inactive');
    truckId = qr.truckId;
  }

  // Check no active visit
  const existing = await prisma.visit.findFirst({
    where: { truckId, status: 'ACTIVE' },
  });
  if (existing) throw new Error('Truck already has an active visit');

  const visit = await prisma.visit.create({
    data: {
      truckId,
      visitType,
      gateInAt: now,
      events: {
        create: {
          stageKey: 'GATE_IN',
          stageNum: 1,
          startAt: now,
          triggeredById: userId,
        },
      },
    },
    include: { events: true, truck: true },
  });

  return visit;
}

// ─── startStage ──────────────────────────────────────────────────────────────

export async function startStage(opts: {
  visitId: string;
  stageKey: StageKey;
  userId: string;
  userRole: string;
  notes?: string;
}) {
  const { visitId, stageKey, userId, userRole, notes } = opts;

  // Role check
  const allowed = STAGE_ROLE_PERMISSIONS[stageKey];
  if (allowed.length > 0 && !allowed.includes(userRole)) {
    throw new Error(`Role ${userRole} is not permitted to act on stage ${stageKey}`);
  }

  const visit = await prisma.visit.findUniqueOrThrow({
    where: { id: visitId },
    include: { events: true, truck: true },
  });

  if (visit.status !== 'ACTIVE') throw new Error('Visit is not active');

  const seq = VISIT_SEQUENCES[visit.visitType as VisitType];
  const actionable = seq.filter((k) => STAGES[k].capture === 'START_END');

  // Stage must be in this visit's sequence
  if (!seq.includes(stageKey)) throw new Error(`Stage ${stageKey} not in ${visit.visitType} sequence`);
  if (STAGES[stageKey].capture !== 'START_END') throw new Error(`Stage ${stageKey} cannot be manually started`);

  // Must be the next un-started stage
  const idx = actionable.indexOf(stageKey);
  if (idx < 0) throw new Error(`Stage ${stageKey} not actionable`);

  // All previous actionable stages must be ended
  for (let i = 0; i < idx; i++) {
    const prev = findEvent(visit, actionable[i]);
    if (!prev?.endAt) throw new Error(`Stage ${actionable[i]} must be completed first`);
  }

  // Must not already be started
  const existing = findEvent(visit, stageKey);
  if (existing) throw new Error(`Stage ${stageKey} already started`);

  const now = new Date();

  const event = await prisma.stageEvent.create({
    data: {
      visitId,
      stageKey,
      stageNum: STAGES[stageKey].num,
      startAt: now,
      triggeredById: userId,
      notes,
    },
  });

  return event;
}

// ─── endStage ────────────────────────────────────────────────────────────────

export async function endStage(opts: {
  visitId: string;
  stageKey: StageKey;
  userId: string;
  userRole: string;
  notes?: string;
}) {
  const { visitId, stageKey, userId, userRole, notes } = opts;

  const allowed = STAGE_ROLE_PERMISSIONS[stageKey];
  if (allowed.length > 0 && !allowed.includes(userRole)) {
    throw new Error(`Role ${userRole} is not permitted to act on stage ${stageKey}`);
  }

  const visit = await prisma.visit.findUniqueOrThrow({
    where: { id: visitId },
    include: { events: true, truck: true },
  });

  if (visit.status !== 'ACTIVE') throw new Error('Visit is not active');

  const event = findEvent(visit, stageKey);
  if (!event) throw new Error(`Stage ${stageKey} has not been started`);
  if (event.endAt) throw new Error(`Stage ${stageKey} already ended`);

  const now = new Date();
  const duration = diffMinutes(event.startAt, now);

  const updated = await prisma.stageEvent.update({
    where: { id: event.id },
    data: {
      endAt: now,
      durationMinutes: duration,
      triggeredById: userId,
      notes: notes ?? event.notes,
    },
  });

  return updated;
}

// ─── gateOut ─────────────────────────────────────────────────────────────────

export async function gateOut(opts: { visitId: string; userId: string; userRole: string }) {
  const { visitId, userId, userRole } = opts;

  if (!['GATE_OFFICER', 'ADMIN'].includes(userRole)) {
    throw new Error('Only GATE_OFFICER or ADMIN may gate out');
  }

  const visit = await prisma.visit.findUniqueOrThrow({
    where: { id: visitId },
    include: { events: true, truck: true },
  });

  if (visit.status !== 'ACTIVE') throw new Error('Visit is not active');
  if (findEvent(visit, 'GATE_OUT')) throw new Error('Visit already gated out');
  if (!isGateOutReady(visit)) throw new Error('Not all stages are completed');

  const now = new Date();
  const totalMinutes = diffMinutes(visit.gateInAt, now);

  const [, updatedVisit] = await prisma.$transaction([
    prisma.stageEvent.create({
      data: {
        visitId,
        stageKey: 'GATE_OUT',
        stageNum: 8,
        startAt: now,
        triggeredById: userId,
      },
    }),
    prisma.visit.update({
      where: { id: visitId },
      data: { status: 'COMPLETED', gateOutAt: now, totalMinutes },
      include: { events: true, truck: true },
    }),
  ]);

  await notifyGateOut(updatedVisit);

  return updatedVisit;
}
