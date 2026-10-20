import prisma from './prisma';
import {
  VISIT_SEQUENCES,
  STAGES,
  getActionableStages,
  STAGE_ROLE_PERMISSIONS,
  CHAINED_NEXT,
  UNDO_WINDOW_MS,
  diffMinutes,
  StageKey,
  VisitType,
} from './stages';
import { notifyGateOut } from './notifications';
import { DEFAULT_TARGETS, healthFor, tctKey, type Targets } from './targets';
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
    const truck = await findTruckByCode(code);
    if (!truck) throw new Error(`No registered truck matches "${code}"`);
    truckId = truck.id;
  }

  // Check no active visit
  const existing = await prisma.visit.findFirst({
    where: { truckId, status: 'ACTIVE' },
  });
  if (existing) throw new Error('This truck is already on site');

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
  /** Server-generated only; lets chained actions share one timestamp. */
  at?: Date;
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

  const now = opts.at ?? new Date();

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
  /** Server-generated only; lets chained actions share one timestamp. */
  at?: Date;
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

  const now = opts.at ?? new Date();
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

// ─── Truck lookup ────────────────────────────────────────────────────────────

/** Uppercase and strip everything but letters/digits, so "kja 482xa" matches "KJA-482-XA". */
export function normalizePlate(s: string): string {
  return s.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** Resolve a scanned QR payload, typed code, or plate number to a truck. */
export async function findTruckByCode(code: string) {
  const trimmed = code.trim();
  const qr = await prisma.qRCode.findUnique({ where: { codeString: trimmed }, include: { truck: true } });
  if (qr) return qr.isActive && qr.truck.isActive ? qr.truck : null;

  const wanted = normalizePlate(trimmed.replace(/^TF-/i, ''));
  if (!wanted) return null;
  const trucks = await prisma.truck.findMany({ where: { isActive: true } });
  return trucks.find((t) => normalizePlate(t.plateNumber) === wanted) ?? null;
}

// ─── Visit type suggestion ───────────────────────────────────────────────────

/**
 * Pre-select the visit type at the gate so the officer usually just confirms.
 * A truck whose last visit only offloaded empties is coming back to load.
 */
export async function suggestVisitType(truckId: string): Promise<{ visitType: VisitType; reason: string }> {
  const last = await prisma.visit.findFirst({
    where: { truckId, status: 'COMPLETED' },
    orderBy: { gateOutAt: 'desc' },
  });
  if (!last) return { visitType: 'FULL_CYCLE', reason: 'First visit on record' };
  const when = last.gateOutAt?.toLocaleDateString('en-NG', { day: 'numeric', month: 'short' }) ?? 'last visit';
  if (last.visitType === 'OFFLOAD_ONLY') {
    return { visitType: 'LOAD_ONLY', reason: `Dropped empties on ${when}, now back to load` };
  }
  return { visitType: 'FULL_CYCLE', reason: `Last visit ${when} was a full cycle` };
}

// ─── Next step ───────────────────────────────────────────────────────────────

export type NextStep =
  | { kind: 'START' | 'END'; stageKey: StageKey; roles: string[]; chainsTo?: StageKey }
  | { kind: 'GATE_OUT'; roles: string[] }
  | { kind: 'DONE' };

const GATE_ROLES = ['GATE_OFFICER', 'ADMIN'];

/** The single thing that must happen next for this visit, and who may do it. */
export function nextStep(visit: VisitWithEvents): NextStep {
  if (visit.status !== 'ACTIVE') return { kind: 'DONE' };
  const actionable = getActionableStages(visit.visitType as VisitType);
  for (const key of actionable) {
    const ev = findEvent(visit, key);
    const roles = STAGE_ROLE_PERMISSIONS[key];
    if (!ev) return { kind: 'START', stageKey: key, roles };
    if (!ev.endAt) {
      const chained = CHAINED_NEXT[key];
      const chainsTo =
        chained && actionable.includes(chained) && !findEvent(visit, chained) ? chained : undefined;
      return { kind: 'END', stageKey: key, roles, chainsTo };
    }
  }
  return { kind: 'GATE_OUT', roles: GATE_ROLES };
}

export function actionLabel(step: NextStep): string {
  switch (step.kind) {
    case 'START':
      return `Start ${STAGES[step.stageKey].name.toLowerCase()}`;
    case 'END':
      return step.chainsTo
        ? `Finish ${STAGES[step.stageKey].name.toLowerCase()}, start ${STAGES[step.chainsTo].name.toLowerCase()}`
        : `Finish ${STAGES[step.stageKey].name.toLowerCase()}`;
    case 'GATE_OUT':
      return 'Gate out';
    case 'DONE':
      return 'Visit complete';
  }
}

// ─── Live summary (queue rows, scan results, visit header) ──────────────────

export type Health = 'ok' | 'warn' | 'over';

export function describeVisit(visit: VisitWithEvents, now = new Date(), targets: Targets = DEFAULT_TARGETS) {
  const step = nextStep(visit);
  const stage = currentStage(visit);

  // "Waiting since" = when the truck became ready for the next step.
  let since: Date = visit.gateInAt;
  let thresholdKey: string | null = null;
  if (step.kind === 'END') {
    since = findEvent(visit, step.stageKey)!.startAt;
    thresholdKey = step.stageKey;
  } else if (step.kind === 'START' || step.kind === 'GATE_OUT') {
    const ended = visit.events
      .filter((e) => e.endAt)
      .sort((a, b) => b.endAt!.getTime() - a.endAt!.getTime())[0];
    since = ended?.endAt ?? visit.gateInAt;
    // No stage started yet → the truck is still queuing.
    if (!ended && step.kind === 'START') thresholdKey = 'QUEUING';
  }

  const minutesInStep = step.kind === 'DONE' ? null : diffMinutes(since, now);
  const health: Health = thresholdKey ? healthFor(targets[thresholdKey], minutesInStep) : 'ok';
  const totalElapsed = diffMinutes(visit.gateInAt, visit.gateOutAt ?? now);
  const tct = targets[tctKey(visit.visitType)] ?? null;

  const isQueuing = thresholdKey === 'QUEUING';
  const statusLabel =
    step.kind === 'END'
      ? STAGES[step.stageKey].name
      : step.kind === 'GATE_OUT'
        ? 'Ready to exit'
        : step.kind === 'START'
          ? isQueuing
            ? 'Queuing'
            : `Waiting for ${STAGES[step.stageKey].name.toLowerCase()}`
          : 'Complete';

  return {
    id: visit.id,
    truckId: visit.truckId,
    truckPlate: visit.truck.plateNumber,
    driverName: visit.truck.driverName,
    visitType: visit.visitType,
    status: visit.status,
    gateInAt: visit.gateInAt,
    currentStage: stage,
    statusLabel,
    inProgress: step.kind === 'END',
    minutesInStep,
    health,
    totalElapsed,
    tct: tct ? { ...tct, health: healthFor(tct, totalElapsed) } : null,
    queuingMinutes: queuingDuration(visit),
    next: { ...step, label: actionLabel(step) },
  };
}

export type VisitSummary = ReturnType<typeof describeVisit>;

// ─── advance: perform the next step in one tap ──────────────────────────────

export async function advance(opts: {
  visitId: string;
  userId: string;
  userRole: string;
  /** What the client believed the next step was; guards against double taps and stale screens. */
  expect?: { kind: string; stageKey?: string };
  notes?: string;
}) {
  const { visitId, userId, userRole, expect, notes } = opts;
  const visit = await prisma.visit.findUniqueOrThrow({
    where: { id: visitId },
    include: { events: true, truck: true },
  });
  const step = nextStep(visit);

  if (step.kind === 'DONE') throw new Error('This visit is already complete');
  if (expect && (expect.kind !== step.kind || (expect.stageKey ?? null) !== ('stageKey' in step ? step.stageKey : null))) {
    throw new Error(`Already updated by someone else. Next step is now: ${actionLabel(step)}`);
  }
  if (!step.roles.includes(userRole)) throw new Error(`${actionLabel(step)} is not your step`);

  if (step.kind === 'GATE_OUT') {
    await gateOut({ visitId, userId, userRole });
    return { did: 'Gated out' };
  }

  const at = new Date();
  if (step.kind === 'START') {
    await startStage({ visitId, stageKey: step.stageKey, userId, userRole, at, notes });
    return { did: `Started ${STAGES[step.stageKey].name.toLowerCase()}` };
  }

  await endStage({ visitId, stageKey: step.stageKey, userId, userRole, at, notes });
  if (step.chainsTo && STAGE_ROLE_PERMISSIONS[step.chainsTo].includes(userRole)) {
    await startStage({ visitId, stageKey: step.chainsTo, userId, userRole, at });
    return { did: `Finished ${STAGES[step.stageKey].name.toLowerCase()}, started ${STAGES[step.chainsTo].name.toLowerCase()}` };
  }
  return { did: `Finished ${STAGES[step.stageKey].name.toLowerCase()}` };
}

// ─── undoLast: take back your most recent action within the window ──────────

export async function undoLast(opts: { visitId: string; userId: string }) {
  const { visitId, userId } = opts;
  const visit = await prisma.visit.findUniqueOrThrow({
    where: { id: visitId },
    include: { events: true, truck: true },
  });
  if (visit.status !== 'ACTIVE') throw new Error('Gate out cannot be undone');

  const actionTime = (e: (typeof visit.events)[number]) => (e.endAt ?? e.startAt).getTime();
  const latest = [...visit.events].sort((a, b) => actionTime(b) - actionTime(a))[0];
  if (!latest || latest.triggeredById !== userId) throw new Error('Nothing of yours to undo here');
  const t = actionTime(latest);
  if (Date.now() - t > UNDO_WINDOW_MS) throw new Error('Too late to undo; ask a supervisor');

  // A gate-in with nothing after it: remove the visit entirely (e.g. wrong truck or type).
  if (latest.stageKey === 'GATE_IN') {
    await prisma.$transaction([
      prisma.stageEvent.deleteMany({ where: { visitId } }),
      prisma.visit.delete({ where: { id: visitId } }),
    ]);
    return { undid: 'Gate in cancelled', visitDeleted: true };
  }

  // Revert everything this user recorded at that instant (covers chained finish+start).
  const startedThen = visit.events.filter((e) => !e.endAt && e.startAt.getTime() === t && e.triggeredById === userId);
  const endedThen = visit.events.filter((e) => e.endAt?.getTime() === t && e.triggeredById === userId);
  await prisma.$transaction([
    prisma.stageEvent.deleteMany({ where: { id: { in: startedThen.map((e) => e.id) } } }),
    ...endedThen.map((e) =>
      prisma.stageEvent.update({ where: { id: e.id }, data: { endAt: null, durationMinutes: null } })
    ),
  ]);
  return { undid: 'Last action undone', visitDeleted: false };
}
