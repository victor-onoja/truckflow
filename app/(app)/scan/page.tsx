'use client';
import { useCallback, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { ArrowRight, LogIn, Search, Sparkles, X } from 'lucide-react';
import { Button, ErrorNote } from '@/components/ui';
import ActionPanel, { UndoToast, type Toast } from '@/components/ActionPanel';
import VisitTypeBadge, { VISIT_TYPE_LABELS } from '@/components/VisitTypeBadge';
import StagePill from '@/components/StagePill';
import { useMe } from '@/hooks/useMe';
import { fmtMinutes, type VisitSummary } from '@/lib/client-types';

const QrScanner = dynamic(() => import('@/components/QrScanner'), { ssr: false });

type VisitType = 'FULL_CYCLE' | 'OFFLOAD_ONLY' | 'LOAD_ONLY';
const TYPE_HELP: Record<VisitType, string> = {
  FULL_CYCLE: 'Offload empties, then load product',
  OFFLOAD_ONLY: 'Drop empties only, no loading',
  LOAD_ONLY: 'Load product only',
};

type Resolved = {
  truck: { id: string; plateNumber: string; driverName: string };
  activeVisit: VisitSummary | null;
  suggestion: { visitType: VisitType; reason: string } | null;
};

export default function ScanPage() {
  const me = useMe();
  const role = me?.role ?? '';
  const isGate = role === 'GATE_OFFICER' || role === 'ADMIN';

  const [code, setCode] = useState('');
  const [looking, setLooking] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<Resolved | null>(null);
  const [visitType, setVisitType] = useState<VisitType>('FULL_CYCLE');
  const [gating, setGating] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);

  const lookup = useCallback(async (raw: string) => {
    const q = raw.trim();
    if (!q) return;
    setLooking(true);
    setError('');
    try {
      const r = await fetch(`/api/trucks/resolve?code=${encodeURIComponent(q)}`).then((x) => x.json());
      if (!r.ok) {
        setResult(null);
        setError(r.error);
        return;
      }
      setResult(r.data);
      if (r.data.suggestion) setVisitType(r.data.suggestion.visitType);
    } catch {
      setError('No connection. Check signal and try again.');
    } finally {
      setLooking(false);
    }
  }, []);

  const reset = () => {
    setResult(null);
    setCode('');
    setError('');
  };

  const refresh = () => {
    if (result) lookup(result.truck.plateNumber);
  };

  const gateIn = async () => {
    if (!result) return;
    setGating(true);
    setError('');
    try {
      const r = await fetch('/api/gate-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ truckId: result.truck.id, visitType }),
      }).then((x) => x.json());
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setToast({
        id: Date.now(),
        visitId: r.data.id,
        message: `${result.truck.plateNumber} checked in · ${VISIT_TYPE_LABELS[visitType].toLowerCase()}`,
        undoable: true,
      });
      reset(); // straight back to scanning for the next truck
    } catch {
      setError('No connection. Check signal and try again.');
    } finally {
      setGating(false);
    }
  };

  const v = result?.activeVisit;

  return (
    <div className="max-w-xl mx-auto">
      <h1 className="text-2xl font-bold tracking-tight mb-4">Scan a truck</h1>

      <div
        className={`relative rounded-2xl overflow-hidden bg-charcoal transition-[height] duration-200 ${
          result ? 'h-28' : 'h-[min(62vh,26rem)]'
        }`}
      >
        <QrScanner onScan={lookup} paused={!!result || looking} />
        {!result && (
          <p className="absolute bottom-3 inset-x-0 text-center text-sm text-paper/90 pointer-events-none">
            Point at the QR code on the truck
          </p>
        )}
      </div>

      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          lookup(code);
        }}
      >
        <label htmlFor="code" className="sr-only">Plate number or truck code</label>
        <input
          id="code"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="Or type the plate, e.g. KJA 482 XA"
          autoComplete="off"
          autoCapitalize="characters"
          className="flex-1 min-w-0 min-h-14 rounded-xl border-2 border-line bg-surface px-4 text-lg font-mono placeholder:font-sans placeholder:text-base placeholder:text-ink-2/80 focus:border-amber-ink focus:outline-none"
        />
        <Button type="submit" variant="dark" loading={looking} disabled={!code.trim()} aria-label="Find truck" icon={<Search className="size-5" aria-hidden />} />
      </form>

      <div className="mt-3">
        <ErrorNote>{error}</ErrorNote>
      </div>

      {result && (
        <section aria-live="polite" className="anim-done mt-4 bg-surface rounded-2xl shadow-card p-5">
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <p className="font-mono font-semibold text-2xl tracking-wide">{result.truck.plateNumber}</p>
              <p className="text-ink-2">{result.truck.driverName}</p>
            </div>
            <button onClick={reset} className="grid place-items-center size-11 -mr-2 -mt-1 rounded-xl text-ink-2 hover:bg-charcoal/5" aria-label="Clear and scan another">
              <X className="size-5" aria-hidden />
            </button>
          </div>

          {v ? (
            <>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <VisitTypeBadge type={v.visitType} />
                <StagePill label={v.statusLabel} minutes={v.minutesInStep} health={v.health} ready={v.next.kind === 'GATE_OUT'} />
                <span className="text-sm text-ink-2 tnum">In plant {fmtMinutes(v.totalElapsed)}</span>
              </div>
              <div className="mt-5">
                <ActionPanel visit={v} role={role} onChanged={refresh} onVisitGone={reset} />
              </div>
              <Link href={`/visit/${v.id}`} className="mt-4 inline-flex items-center gap-1.5 min-h-11 font-semibold text-amber-ink hover:underline">
                Full visit timeline <ArrowRight className="size-4" aria-hidden />
              </Link>
            </>
          ) : isGate ? (
            <>
              <fieldset className="mt-5">
                <legend className="text-sm font-semibold mb-2">Visit type</legend>
                <div className="grid gap-2">
                  {(Object.keys(TYPE_HELP) as VisitType[]).map((t) => {
                    const selected = visitType === t;
                    const suggested = result.suggestion?.visitType === t;
                    return (
                      <label
                        key={t}
                        className={`flex items-center gap-3 min-h-14 px-4 py-2.5 rounded-xl border-2 cursor-pointer transition-colors ${
                          selected ? 'border-charcoal bg-charcoal/[0.04]' : 'border-line hover:border-line-strong'
                        }`}
                      >
                        <input
                          type="radio"
                          name="visitType"
                          value={t}
                          checked={selected}
                          onChange={() => setVisitType(t)}
                          className="size-5 accent-charcoal"
                        />
                        <span className="flex-1">
                          <span className="block font-semibold">
                            {VISIT_TYPE_LABELS[t]}
                            {suggested && (
                              <span className="ml-2 inline-flex items-center gap-1 text-xs font-semibold text-amber-ink bg-amber-wash px-1.5 py-0.5 rounded-md align-middle">
                                <Sparkles className="size-3" aria-hidden /> Suggested
                              </span>
                            )}
                          </span>
                          <span className="block text-sm text-ink-2">{TYPE_HELP[t]}</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
                {result.suggestion && <p className="mt-2 text-sm text-ink-2">{result.suggestion.reason}.</p>}
              </fieldset>
              <Button size="xl" className="w-full mt-5" loading={gating} onClick={gateIn} icon={<LogIn className="size-6" aria-hidden />}>
                Gate in {result.truck.plateNumber}
              </Button>
            </>
          ) : (
            <p className="mt-4 text-ink-2">This truck isn’t in the plant. The gate checks trucks in.</p>
          )}
        </section>
      )}

      {toast && <UndoToast key={toast.id} toast={toast} onClose={() => setToast(null)} onUndone={() => {}} onVisitGone={() => {}} />}
    </div>
  );
}
