import { describe, it, expect, beforeEach, afterEach } from 'vitest';
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
} from '../lib/stage-machine';

// Use a separate in-memory approach by pointing to the real dev DB for tests
// but clean up created records after each test
const prisma = new PrismaClient();

let userId: string;
let truckIds: Record<string, string> = {};

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
  // Clean up test visits and user
  await prisma.stageEvent.deleteMany({ where: { triggeredById: userId } });
  await prisma.visit.deleteMany({ where: { truckId: { in: Object.values(truckIds) } } });
  await prisma.user.delete({ where: { id: userId } });
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

async function getVisit(id: string) {
  return prisma.visit.findUniqueOrThrow({
    where: { id },
    include: { events: true, truck: true },
  });
}
