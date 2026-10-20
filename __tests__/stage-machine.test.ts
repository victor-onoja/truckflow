import { describe, it, expect, beforeEach, afterEach, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import {
  gateIn,
  startStage,
  endStage,
  gateOut,
  queuingDuration,
  isGateOutReady,
  currentStage,
  advance,
  undoLast,
  nextStep,
  findTruckByCode,
  suggestVisitType,
  describeVisit,
} from '../lib/stage-machine';
import { DEFAULT_TARGETS, healthFor } from '../lib/targets';
import { getTargets, saveTargets } from '../lib/targets-server';

// Runs against prisma/test.db (see global-setup.ts), created fresh and deleted
// after each run; per-test cleanup below keeps tests independent of each other.
const prisma = new PrismaClient();

let userId: string;
const truckIds: Record<string, string> = {};

beforeEach(async () => {
  const pinHash = await bcrypt.hash('1234', 10);
  const user = await prisma.user.create({
    data: { phone: `test-${Date.now()}`, pinHash, fullName: 'Test User', role: 'ADMIN' },
  });
  userId = user.id;

  // Create 3 test trucks
  for (const plate of ['TEST-001', 'TEST-002', 'TEST-003']) {
    const truck = await prisma.truck.upsert({
      where: { plateNumber: plate },
      update: {},
      create: {
        plateNumber: plate,
        driverName: 'Test Driver',
        qrCodes: { create: { codeString: `TF-${plate}`, type: 'PERMANENT' } },
      },
    });
    truckIds[plate] = truck.id;
  }
});

afterEach(async () => {
  const visitIds = (await prisma.visit.findMany({ where: { truckId: { in: Object.values(truckIds) } } })).map((v) => v.id);
  await prisma.notification.deleteMany({ where: { visitId: { in: visitIds } } });
  await prisma.stageEvent.deleteMany({ where: { visitId: { in: visitIds } } });
  await prisma.visit.deleteMany({ where: { id: { in: visitIds } } });
  await prisma.user.delete({ where: { id: userId } });
});

afterAll(async () => {
  await prisma.qRCode.deleteMany({ where: { truckId: { in: Object.values(truckIds) } } });
  await prisma.truck.deleteMany({ where: { id: { in: Object.values(truckIds) } } });
  await prisma.$disconnect();
});

// ── FULL_CYCLE sequence ───────────────────────────────────────────────────────
describe('FULL_CYCLE visit', () => {
  it('completes all 8 stages in order', async () => {
    const visit = await gateIn({ truckId: truckIds['TEST-001'], visitType: 'FULL_CYCLE', userId });
    expect(visit.visitType).toBe('FULL_CYCLE');
    expect(currentStage(visit)).toBe('UNLATCHING');

    // UNLATCHING
    await startStage({ visitId: visit.id, stageKey: 'UNLATCHING', userId, userRole: 'ADMIN' });
    let v = await getVisit(visit.id);
    expect(currentStage(v)).toBe('UNLATCHING');
    await endStage({ visitId: visit.id, stageKey: 'UNLATCHING', userId, userRole: 'ADMIN' });

    // OFFLOADING
    await startStage({ visitId: visit.id, stageKey: 'OFFLOADING', userId, userRole: 'ADMIN' });
    await endStage({ visitId: visit.id, stageKey: 'OFFLOADING', userId, userRole: 'ADMIN' });

    // LOADING
    await startStage({ visitId: visit.id, stageKey: 'LOADING', userId, userRole: 'ADMIN' });
    await endStage({ visitId: visit.id, stageKey: 'LOADING', userId, userRole: 'ADMIN' });

    // LATCHING
    await startStage({ visitId: visit.id, stageKey: 'LATCHING', userId, userRole: 'ADMIN' });
    await endStage({ visitId: visit.id, stageKey: 'LATCHING', userId, userRole: 'ADMIN' });

    // FUELING
    await startStage({ visitId: visit.id, stageKey: 'FUELING', userId, userRole: 'ADMIN' });
    await endStage({ visitId: visit.id, stageKey: 'FUELING', userId, userRole: 'ADMIN' });

    v = await getVisit(visit.id);
    expect(isGateOutReady(v)).toBe(true);

    const completed = await gateOut({ visitId: visit.id, userId, userRole: 'ADMIN' });
    expect(completed.status).toBe('COMPLETED');
    expect(completed.gateOutAt).not.toBeNull();
  });
});

// ── OFFLOAD_ONLY sequence ─────────────────────────────────────────────────────
describe('OFFLOAD_ONLY visit', () => {
  it('completes without LOADING, LATCHING, FUELING stages', async () => {
    const visit = await gateIn({ truckId: truckIds['TEST-002'], visitType: 'OFFLOAD_ONLY', userId });

    await startStage({ visitId: visit.id, stageKey: 'UNLATCHING', userId, userRole: 'ADMIN' });
    await endStage({ visitId: visit.id, stageKey: 'UNLATCHING', userId, userRole: 'ADMIN' });
    await startStage({ visitId: visit.id, stageKey: 'OFFLOADING', userId, userRole: 'ADMIN' });
    await endStage({ visitId: visit.id, stageKey: 'OFFLOADING', userId, userRole: 'ADMIN' });

    const v = await getVisit(visit.id);
    expect(isGateOutReady(v)).toBe(true);

    const completed = await gateOut({ visitId: visit.id, userId, userRole: 'ADMIN' });
    expect(completed.status).toBe('COMPLETED');
  });

  it('rejects FUELING on OFFLOAD_ONLY visit', async () => {
    const visit = await gateIn({ truckId: truckIds['TEST-002'], visitType: 'OFFLOAD_ONLY', userId });
    await expect(
      startStage({ visitId: visit.id, stageKey: 'FUELING', userId, userRole: 'ADMIN' })
    ).rejects.toThrow();
  });

  it('rejects LOADING on OFFLOAD_ONLY visit', async () => {
    const visit = await gateIn({ truckId: truckIds['TEST-002'], visitType: 'OFFLOAD_ONLY', userId });
    await expect(
      startStage({ visitId: visit.id, stageKey: 'LOADING', userId, userRole: 'ADMIN' })
    ).rejects.toThrow();
  });
});

// ── LOAD_ONLY sequence ────────────────────────────────────────────────────────
describe('LOAD_ONLY visit', () => {
  it('skips unlatching and offloading', async () => {
    const visit = await gateIn({ truckId: truckIds['TEST-003'], visitType: 'LOAD_ONLY', userId });

    await startStage({ visitId: visit.id, stageKey: 'LOADING', userId, userRole: 'ADMIN' });
    await endStage({ visitId: visit.id, stageKey: 'LOADING', userId, userRole: 'ADMIN' });
    await startStage({ visitId: visit.id, stageKey: 'LATCHING', userId, userRole: 'ADMIN' });
    await endStage({ visitId: visit.id, stageKey: 'LATCHING', userId, userRole: 'ADMIN' });
    await startStage({ visitId: visit.id, stageKey: 'FUELING', userId, userRole: 'ADMIN' });
    await endStage({ visitId: visit.id, stageKey: 'FUELING', userId, userRole: 'ADMIN' });

    const v = await getVisit(visit.id);
    expect(isGateOutReady(v)).toBe(true);
  });

  it('queuing derivation uses LOADING as first post-queue stage', async () => {
    const visit = await gateIn({ truckId: truckIds['TEST-003'], visitType: 'LOAD_ONLY', userId });

    // Before loading starts, queuing is null
    let v = await getVisit(visit.id);
    expect(queuingDuration(v)).toBeNull();

    await startStage({ visitId: visit.id, stageKey: 'LOADING', userId, userRole: 'ADMIN' });
    v = await getVisit(visit.id);
    const q = queuingDuration(v);
    expect(q).not.toBeNull();
    expect(q!).toBeGreaterThanOrEqual(0);
  });
});

// ── Out-of-order rejections ───────────────────────────────────────────────────
describe('transition rejections', () => {
  it('rejects starting a stage before the previous one ends', async () => {
    const visit = await gateIn({ truckId: truckIds['TEST-001'], visitType: 'FULL_CYCLE', userId });
    await startStage({ visitId: visit.id, stageKey: 'UNLATCHING', userId, userRole: 'ADMIN' });
    await expect(
      startStage({ visitId: visit.id, stageKey: 'OFFLOADING', userId, userRole: 'ADMIN' })
    ).rejects.toThrow();
  });

  it('rejects double-starting a stage', async () => {
    const visit = await gateIn({ truckId: truckIds['TEST-001'], visitType: 'FULL_CYCLE', userId });
    await startStage({ visitId: visit.id, stageKey: 'UNLATCHING', userId, userRole: 'ADMIN' });
    await expect(
      startStage({ visitId: visit.id, stageKey: 'UNLATCHING', userId, userRole: 'ADMIN' })
    ).rejects.toThrow();
  });

  it('rejects ending a stage that was not started', async () => {
    const visit = await gateIn({ truckId: truckIds['TEST-001'], visitType: 'FULL_CYCLE', userId });
    await expect(
      endStage({ visitId: visit.id, stageKey: 'UNLATCHING', userId, userRole: 'ADMIN' })
    ).rejects.toThrow();
  });

  it('rejects gate out when stages are still open', async () => {
    const visit = await gateIn({ truckId: truckIds['TEST-001'], visitType: 'FULL_CYCLE', userId });
    await expect(
      gateOut({ visitId: visit.id, userId, userRole: 'ADMIN' })
    ).rejects.toThrow();
  });

  it('rejects duplicate gate-in for same truck', async () => {
    await gateIn({ truckId: truckIds['TEST-001'], visitType: 'FULL_CYCLE', userId });
    await expect(
      gateIn({ truckId: truckIds['TEST-001'], visitType: 'FULL_CYCLE', userId })
    ).rejects.toThrow();
  });

  it('rejects wrong role for stage', async () => {
    const visit = await gateIn({ truckId: truckIds['TEST-001'], visitType: 'FULL_CYCLE', userId });
    await expect(
      startStage({ visitId: visit.id, stageKey: 'UNLATCHING', userId, userRole: 'FUELING_STAFF' })
    ).rejects.toThrow();
  });
});

// ── Queuing derivation ────────────────────────────────────────────────────────
describe('queuing derivation', () => {
  it('uses UNLATCHING start for FULL_CYCLE', async () => {
    const visit = await gateIn({ truckId: truckIds['TEST-001'], visitType: 'FULL_CYCLE', userId });
    let v = await getVisit(visit.id);
    expect(queuingDuration(v)).toBeNull();

    await startStage({ visitId: visit.id, stageKey: 'UNLATCHING', userId, userRole: 'ADMIN' });
    v = await getVisit(visit.id);
    expect(queuingDuration(v)).not.toBeNull();
  });
});

// ── One-tap advance ───────────────────────────────────────────────────────────
describe('advance', () => {
  it('runs a FULL_CYCLE visit in 6 taps by chaining back-to-back stages', async () => {
    const visit = await gateIn({ truckId: truckIds['TEST-001'], visitType: 'FULL_CYCLE', userId });
    const did: string[] = [];
    for (let i = 0; i < 10; i++) {
      const step = nextStep(await getVisit(visit.id));
      if (step.kind === 'DONE') break;
      did.push((await advance({ visitId: visit.id, userId, userRole: 'ADMIN' })).did);
    }
    expect(did).toEqual([
      'Started unlatching',
      'Finished unlatching, started offloading',
      'Finished offloading',
      'Started loading',
      'Finished loading, started latching',
      'Finished latching',
      'Started fueling',
      'Finished fueling',
      'Gated out',
    ]);
    const v = await getVisit(visit.id);
    expect(v.status).toBe('COMPLETED');
    // Chained stages share one timestamp: no gap invented between them.
    const unl = v.events.find((e) => e.stageKey === 'UNLATCHING')!;
    const off = v.events.find((e) => e.stageKey === 'OFFLOADING')!;
    expect(unl.endAt!.getTime()).toBe(off.startAt.getTime());
  });

  it('rejects a stale or double tap', async () => {
    const visit = await gateIn({ truckId: truckIds['TEST-001'], visitType: 'FULL_CYCLE', userId });
    const expect1 = { kind: 'START', stageKey: 'UNLATCHING' };
    await advance({ visitId: visit.id, userId, userRole: 'ADMIN', expect: expect1 });
    await expect(advance({ visitId: visit.id, userId, userRole: 'ADMIN', expect: expect1 })).rejects.toThrow(/Already updated/);
  });

  it('refuses a step that belongs to another role', async () => {
    const visit = await gateIn({ truckId: truckIds['TEST-003'], visitType: 'LOAD_ONLY', userId });
    await expect(advance({ visitId: visit.id, userId, userRole: 'FUELING_STAFF' })).rejects.toThrow(/not your step/);
  });
});

// ── Undo ──────────────────────────────────────────────────────────────────────
describe('undoLast', () => {
  it('reverts a chained finish+start as one action', async () => {
    const visit = await gateIn({ truckId: truckIds['TEST-001'], visitType: 'FULL_CYCLE', userId });
    await advance({ visitId: visit.id, userId, userRole: 'ADMIN' }); // start unlatching
    await advance({ visitId: visit.id, userId, userRole: 'ADMIN' }); // finish unlatching + start offloading
    await undoLast({ visitId: visit.id, userId });
    const v = await getVisit(visit.id);
    expect(v.events.find((e) => e.stageKey === 'OFFLOADING')).toBeUndefined();
    expect(v.events.find((e) => e.stageKey === 'UNLATCHING')!.endAt).toBeNull();
  });

  it('cancels a gate-in with nothing after it', async () => {
    const visit = await gateIn({ truckId: truckIds['TEST-002'], visitType: 'FULL_CYCLE', userId });
    const r = await undoLast({ visitId: visit.id, userId });
    expect(r.visitDeleted).toBe(true);
    expect(await prisma.visit.findUnique({ where: { id: visit.id } })).toBeNull();
  });
});

// ── Lookup & suggestion ───────────────────────────────────────────────────────
describe('truck lookup and visit-type suggestion', () => {
  it('finds a truck from QR payload or loosely typed plate', async () => {
    expect((await findTruckByCode('TF-TEST-001'))?.id).toBe(truckIds['TEST-001']);
    expect((await findTruckByCode(' test 001 '))?.id).toBe(truckIds['TEST-001']);
    expect(await findTruckByCode('NOPE-999')).toBeNull();
  });

  it('suggests LOAD_ONLY after an offload-only visit', async () => {
    expect((await suggestVisitType(truckIds['TEST-002'])).visitType).toBe('FULL_CYCLE');
    const visit = await gateIn({ truckId: truckIds['TEST-002'], visitType: 'OFFLOAD_ONLY', userId });
    for (let i = 0; i < 4; i++) await advance({ visitId: visit.id, userId, userRole: 'ADMIN' });
    expect((await getVisit(visit.id)).status).toBe('COMPLETED');
    expect((await suggestVisitType(truckIds['TEST-002'])).visitType).toBe('LOAD_ONLY');
  });
});

// ── Editable time targets ────────────────────────────────────────────────────
describe('time targets', () => {
  afterEach(async () => {
    await prisma.timeTarget.deleteMany();
  });

  it('grades minutes against target and limit', () => {
    const t = { target: 10, limit: 20 };
    expect(healthFor(t, 9)).toBe('ok');
    expect(healthFor(t, 10)).toBe('warn');
    expect(healthFor(t, 20)).toBe('over');
  });

  it('uses saved targets over defaults, and they drive visit health', async () => {
    expect((await getTargets()).QUEUING).toEqual(DEFAULT_TARGETS.QUEUING);
    const saved = await saveTargets({ QUEUING: { target: 1, limit: 2 }, TCT_FULL_CYCLE: { target: 1, limit: 2 } }, userId);
    expect(saved.QUEUING).toEqual({ target: 1, limit: 2 });
    expect(saved.LOADING).toEqual(DEFAULT_TARGETS.LOADING);

    const visit = await gateIn({ truckId: truckIds['TEST-001'], visitType: 'FULL_CYCLE', userId });
    const in5 = new Date(Date.now() + 5 * 60_000);
    const s = describeVisit(await getVisit(visit.id), in5, saved);
    expect(s.health).toBe('over'); // queuing 5m vs 2m limit
    expect(s.tct?.health).toBe('over');
    expect(describeVisit(await getVisit(visit.id), in5).health).toBe('ok'); // defaults: 30m target
  });
});

async function getVisit(id: string) {
  return prisma.visit.findUniqueOrThrow({
    where: { id },
    include: { events: true, truck: true },
  });
}
