import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth, ok, err } from '@/lib/api-helpers';
import { saveTargets } from '@/lib/targets-server';
import { TARGET_KEYS } from '@/lib/targets';

const minutes = z.number().int().min(1).max(24 * 60);
const schema = z.record(
  z.enum(TARGET_KEYS as [string, ...string[]]),
  z.object({ target: minutes, limit: minutes }).refine((t) => t.limit > t.target, {
    message: 'Limit must be longer than the target',
  })
);

export async function PUT(req: NextRequest) {
  return withAuth(req, ['ADMIN'], async (session) => {
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return err(`${issue.path.join(' ')}: ${issue.message}`);
    }
    return ok(await saveTargets(parsed.data, session.userId));
  });
}
