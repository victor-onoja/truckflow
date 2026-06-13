import { NextRequest, NextResponse } from 'next/server';
import { withAuth, err } from '@/lib/api-helpers';
import prisma from '@/lib/prisma';
import QRCode from 'qrcode';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, ['ADMIN'], async () => {
    const { id } = await params;
    const truck = await prisma.truck.findUnique({
      where: { id },
      include: { qrCodes: { where: { type: 'PERMANENT', isActive: true }, take: 1 } },
    });
    if (!truck || truck.qrCodes.length === 0) return err('QR code not found', 404);

    const png = await QRCode.toBuffer(truck.qrCodes[0].codeString, { width: 400 });
    return new NextResponse(png as unknown as BodyInit, {
      headers: {
        'Content-Type': 'image/png',
        'Content-Disposition': `attachment; filename="${truck.plateNumber}-qr.png"`,
      },
    });
  });
}
