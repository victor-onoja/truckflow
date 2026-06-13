import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { verifyPin, signSession, COOKIE_NAME, COOKIE_MAX_AGE } from '@/lib/auth';

const schema = z.object({ phone: z.string(), pin: z.string().length(4) });

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'Invalid input' }, { status: 400 });

  const { phone, pin } = parsed.data;
  const user = await prisma.user.findUnique({ where: { phone } });
  if (!user || !user.isActive) return NextResponse.json({ ok: false, error: 'Invalid credentials' }, { status: 401 });

  const valid = await verifyPin(pin, user.pinHash);
  if (!valid) return NextResponse.json({ ok: false, error: 'Invalid credentials' }, { status: 401 });

  const token = await signSession({ userId: user.id, role: user.role, fullName: user.fullName });

  const res = NextResponse.json({ ok: true, data: { role: user.role, fullName: user.fullName } });
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  });
  return res;
}
