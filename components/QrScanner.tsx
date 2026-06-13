'use client';
import { useEffect, useRef } from 'react';

export default function QrScanner({ onScan }: { onScan: (code: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scannerRef = useRef<any>(null);

  useEffect(() => {
    if (!ref.current) return;

    let stopped = false;

    import('html5-qrcode').then(({ Html5Qrcode }) => {
      if (stopped || !ref.current) return;
      const scanner = new Html5Qrcode(ref.current.id);
      scannerRef.current = scanner;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const p: any = scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decoded) => {
          if (!stopped) onScan(decoded);
        },
        undefined
      );
      if (p && typeof p.catch === 'function') p.catch(() => {});
    });

    return () => {
      stopped = true;
      try { scannerRef.current?.clear(); } catch { /* ignore */ }
    };
  }, [onScan]);

  return <div id="qr-reader" ref={ref} className="w-full h-full" />;
}
