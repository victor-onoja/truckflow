import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const pinHash = await bcrypt.hash('1234', 10);

  // ── Users ────────────────────────────────────────────────────────────────
  const users = await Promise.all([
    prisma.user.upsert({
      where: { phone: '08010000001' },
      update: {},
      create: { phone: '08010000001', pinHash, fullName: 'Gate Officer Demo', role: 'GATE_OFFICER' },
    }),
    prisma.user.upsert({
      where: { phone: '08010000002' },
      update: {},
      create: { phone: '08010000002', pinHash, fullName: 'Forklift Operator Demo', role: 'FORKLIFT_OPERATOR' },
    }),
    prisma.user.upsert({
      where: { phone: '08010000003' },
      update: {},
      create: { phone: '08010000003', pinHash, fullName: 'Fueling Staff Demo', role: 'FUELING_STAFF' },
    }),
    prisma.user.upsert({
      where: { phone: '08010000004' },
      update: {},
      create: { phone: '08010000004', pinHash, fullName: 'Supervisor Demo', role: 'SUPERVISOR' },
    }),
    prisma.user.upsert({
      where: { phone: '08010000006' },
      update: {},
      create: { phone: '08010000006', pinHash, fullName: 'Admin Demo', role: 'ADMIN' },
    }),
  ]);

  const [gateOfficer] = users;

  // ── Trucks ───────────────────────────────────────────────────────────────
  const plates = ['KJA-482-XA', 'ABJ-301-LG', 'LAG-119-KJ', 'KAN-775-AB', 'RVS-204-FC', 'OND-558-YB'];
  const drivers = ['Emeka Okafor', 'Chidi Nwosu', 'Bola Adeyemi', 'Musa Ibrahim', 'Tunde Fashola', 'Ngozi Eze'];

  const trucks = await Promise.all(
    plates.map((plate, i) =>
      prisma.truck.upsert({
        where: { plateNumber: plate },
        update: {},
        create: {
          plateNumber: plate,
          driverName: drivers[i],
          qrCodes: {
            create: { codeString: `TF-${plate}`, type: 'PERMANENT' },
          },
        },
      })
    )
  );

  // ── Historical COMPLETED visits ──────────────────────────────────────────
  const now = new Date();
  const hoursAgo = (h: number) => new Date(now.getTime() - h * 3600_000);
  const minsAfter = (base: Date, m: number) => new Date(base.getTime() + m * 60_000);

  // 1. FULL_CYCLE completed ~48h ago
  const fc_gate = hoursAgo(48);
  await prisma.visit.upsert({
    where: { id: 'seed-visit-full-cycle' },
    update: {},
    create: {
      id: 'seed-visit-full-cycle',
      truckId: trucks[0].id,
      visitType: 'FULL_CYCLE',
      status: 'COMPLETED',
      gateInAt: fc_gate,
      gateOutAt: minsAfter(fc_gate, 185),
      totalMinutes: 185,
      events: {
        create: [
          { stageKey: 'GATE_IN',    stageNum: 1, startAt: fc_gate,                              triggeredById: gateOfficer.id },
          { stageKey: 'UNLATCHING', stageNum: 3, startAt: minsAfter(fc_gate, 20),  endAt: minsAfter(fc_gate, 35),  durationMinutes: 15, triggeredById: gateOfficer.id },
          { stageKey: 'OFFLOADING', stageNum: 4, startAt: minsAfter(fc_gate, 35),  endAt: minsAfter(fc_gate, 95),  durationMinutes: 60, triggeredById: gateOfficer.id },
          { stageKey: 'LOADING',    stageNum: 5, startAt: minsAfter(fc_gate, 95),  endAt: minsAfter(fc_gate, 155), durationMinutes: 60, triggeredById: gateOfficer.id },
          { stageKey: 'LATCHING',   stageNum: 6, startAt: minsAfter(fc_gate, 155), endAt: minsAfter(fc_gate, 168), durationMinutes: 13, triggeredById: gateOfficer.id },
          { stageKey: 'FUELING',    stageNum: 7, startAt: minsAfter(fc_gate, 168), endAt: minsAfter(fc_gate, 183), durationMinutes: 15, triggeredById: gateOfficer.id },
          { stageKey: 'GATE_OUT',   stageNum: 8, startAt: minsAfter(fc_gate, 185),               triggeredById: gateOfficer.id },
        ],
      },
    },
  });

  // 2. OFFLOAD_ONLY completed ~30h ago
  const oo_gate = hoursAgo(30);
  await prisma.visit.upsert({
    where: { id: 'seed-visit-offload-only' },
    update: {},
    create: {
      id: 'seed-visit-offload-only',
      truckId: trucks[1].id,
      visitType: 'OFFLOAD_ONLY',
      status: 'COMPLETED',
      gateInAt: oo_gate,
      gateOutAt: minsAfter(oo_gate, 105),
      totalMinutes: 105,
      events: {
        create: [
          { stageKey: 'GATE_IN',    stageNum: 1, startAt: oo_gate,                             triggeredById: gateOfficer.id },
          { stageKey: 'UNLATCHING', stageNum: 3, startAt: minsAfter(oo_gate, 15), endAt: minsAfter(oo_gate, 30), durationMinutes: 15, triggeredById: gateOfficer.id },
          { stageKey: 'OFFLOADING', stageNum: 4, startAt: minsAfter(oo_gate, 30), endAt: minsAfter(oo_gate, 100), durationMinutes: 70, triggeredById: gateOfficer.id },
          { stageKey: 'GATE_OUT',   stageNum: 8, startAt: minsAfter(oo_gate, 105),             triggeredById: gateOfficer.id },
        ],
      },
    },
  });

  // 3. LOAD_ONLY completed ~6h ago
  const lo_gate = hoursAgo(6);
  await prisma.visit.upsert({
    where: { id: 'seed-visit-load-only' },
    update: {},
    create: {
      id: 'seed-visit-load-only',
      truckId: trucks[2].id,
      visitType: 'LOAD_ONLY',
      status: 'COMPLETED',
      gateInAt: lo_gate,
      gateOutAt: minsAfter(lo_gate, 100),
      totalMinutes: 100,
      events: {
        create: [
          { stageKey: 'GATE_IN',  stageNum: 1, startAt: lo_gate,                             triggeredById: gateOfficer.id },
          { stageKey: 'LOADING',  stageNum: 5, startAt: minsAfter(lo_gate, 12), endAt: minsAfter(lo_gate, 72),  durationMinutes: 60, triggeredById: gateOfficer.id },
          { stageKey: 'LATCHING', stageNum: 6, startAt: minsAfter(lo_gate, 72), endAt: minsAfter(lo_gate, 85),  durationMinutes: 13, triggeredById: gateOfficer.id },
          { stageKey: 'FUELING',  stageNum: 7, startAt: minsAfter(lo_gate, 85), endAt: minsAfter(lo_gate, 98),  durationMinutes: 13, triggeredById: gateOfficer.id },
          { stageKey: 'GATE_OUT', stageNum: 8, startAt: minsAfter(lo_gate, 100),             triggeredById: gateOfficer.id },
        ],
      },
    },
  });

  // 4. ACTIVE visit currently in OFFLOADING
  const active_gate = hoursAgo(1);
  await prisma.visit.upsert({
    where: { id: 'seed-visit-active' },
    update: {},
    create: {
      id: 'seed-visit-active',
      truckId: trucks[3].id,
      visitType: 'FULL_CYCLE',
      status: 'ACTIVE',
      gateInAt: active_gate,
      events: {
        create: [
          { stageKey: 'GATE_IN',    stageNum: 1, startAt: active_gate,                              triggeredById: gateOfficer.id },
          { stageKey: 'UNLATCHING', stageNum: 3, startAt: minsAfter(active_gate, 10), endAt: minsAfter(active_gate, 25), durationMinutes: 15, triggeredById: gateOfficer.id },
          { stageKey: 'OFFLOADING', stageNum: 4, startAt: minsAfter(active_gate, 25),               triggeredById: gateOfficer.id },
        ],
      },
    },
  });

  console.log('✅ Seed complete');
  console.log('Demo logins (PIN: 1234):');
  console.log('  Gate Officer:      08010000001');
  console.log('  Forklift Operator: 08010000002');
  console.log('  Fueling Staff:     08010000003');
  console.log('  Supervisor:        08010000004');
  console.log('  Admin:             08010000006');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
