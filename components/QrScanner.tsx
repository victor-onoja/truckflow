'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { CameraOff } from 'lucide-react';

const REPEAT_MS = 3000;

/**
 * Camera QR reader. Starts once per mount (the callback is read through a ref,
 * so parent re-renders don't restart the camera), ignores the same code read
 * twice in a row, and releases the camera on unmount.
 */
export default function QrScanner({ onScan, paused = false }: { onScan: (code: string) => void; paused?: boolean }) {
  const id = `qr-${useId().replace(/:/g, '')}`;
  const onScanRef = useRef(onScan);
  const pausedRef = useRef(paused);
  const last = useRef({ code: '', at: 0 });
  const [error, setError] = useState('');

  useEffect(() => {
    onScanRef.current = onScan;
    pausedRef.current = paused;
  }, [onScan, paused]);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let scanner: any = null;

    import('html5-qrcode').then(async ({ Html5Qrcode }) => {
      if (cancelled) return;
      scanner = new Html5Qrcode(id, { verbose: false });
      try {
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: (w: number, h: number) => { const s = Math.floor(Math.min(w, h) * 0.7); return { width: s, height: s }; } },
          (decoded: string) => {
            if (cancelled || pausedRef.current) return;
            const now = Date.now();
            if (decoded === last.current.code && now - last.current.at < REPEAT_MS) return;
            last.current = { code: decoded, at: now };
            navigator.vibrate?.(40);
            onScanRef.current(decoded);
          },
          undefined
        );
        if (cancelled) await scanner.stop().catch(() => {});
      } catch (e) {
        const msg = String(e);
        setError(
          /NotAllowed|Permission/i.test(msg)
            ? 'Camera access is blocked. Allow the camera in your browser settings, or type the plate below.'
            : 'No camera available on this device. Type the plate below instead.'
        );
      }
    });

    return () => {
      cancelled = true;
      if (scanner?.isScanning) scanner.stop().then(() => scanner.clear()).catch(() => {});
    };
  }, [id]);

  if (error) {
    return (
      <div className="h-full grid place-items-center p-6 text-center text-paper">
        <div>
          <CameraOff className="size-8 mx-auto text-on-dark-2" aria-hidden />
          <p className="mt-3 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return <div id={id} className="w-full h-full [&_video]:object-cover [&_video]:h-full" />;
}
