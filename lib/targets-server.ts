import prisma from './prisma';
import { DEFAULT_TARGETS, TARGET_KEYS, type Targets } from './targets';

/** Current targets: stored rows over defaults. The table is tiny, so read it per request. */
export async function getTargets(): Promise<Targets> {
  const rows = await prisma.timeTarget.findMany();
  const merged: Targets = { ...DEFAULT_TARGETS };
  for (const r of rows) {
    if (TARGET_KEYS.includes(r.key)) merged[r.key] = { target: r.targetMin, limit: r.limitMin };
  }
  return merged;
}

export async function saveTargets(next: Targets, userId: string) {
  await prisma.$transaction(
    Object.entries(next)
      .filter(([key]) => TARGET_KEYS.includes(key))
      .map(([key, t]) =>
        prisma.timeTarget.upsert({
          where: { key },
          update: { targetMin: t.target, limitMin: t.limit, updatedById: userId },
          create: { key, targetMin: t.target, limitMin: t.limit, updatedById: userId },
        })
      )
  );
  return getTargets();
}
