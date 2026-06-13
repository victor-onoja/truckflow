'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import VisitTypeBadge from '@/components/VisitTypeBadge';

type StageEntry = {
  key: string;
  name: string;
  capture: string;
  event: { startAt: string; endAt: string | null; durationMinutes: number | null } | null;
};

type VisitDetail = {
  id: string;
  visitType: string;
  status: string;
  gateInAt: string;
  gateOutAt: string | null;
  totalMinutes: number | null;
  currentStage: string;
  gateOutReady: boolean;
  queuingMinutes: number | null;
  truck: { plateNumber: string; driverName: string };
  sequence: StageEntry[];
};

function fmt(d: string) {
  return new Date(d).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' });
}

export default function GateOutPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [visit, setVisit] = useState<VisitDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/visits/${id}`)
      .then((r) => r.json())
      .then((j) => { if (j.ok) setVisit(j.data); setLoading(false); });
  }, [id]);

  const doGateOut = async () => {
    setSubmitting(true); setError('');
    const r = await fetch(`/api/visits/${id}/gate-out`, { method: 'POST' });
    const j = await r.json();
    setSubmitting(false);
    if (!j.ok) { setError(j.error); return; }
    router.push('/queue');
  };

  if (loading) return <div className="py-8 text-center text-charcoal/40">Loading…</div>;
  if (!visit) return <div className="py-8 text-center text-red-alert">Visit not found</div>;
  if (!visit.gateOutReady && visit.status === 'ACTIVE') {
    return (
      <div className="py-8 text-center">
        <p className="text-red-alert font-bold mb-4">Not ready for gate out — stages still in progress</p>
        <Link href={`/visit/${id}`} className="text-amber underline">Back to visit</Link>
      </div>
    );
  }

  const gateInTime = fmt(visit.gateInAt);
  const completedStages = visit.sequence.filter((s) => s.capture === 'START_END' && s.event?.durationMinutes != null);

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <Link href={`/visit/${id}`} className="text-charcoal/40 hover:text-charcoal">←</Link>
        <h2 className="text-xl font-bold">Gate Out</h2>
      </div>

      <div className="bg-white rounded-2xl shadow-sm p-5 mb-4">
        <div className="flex items-center gap-3 mb-4 pb-4 border-b border-charcoal/10">
          <div className="flex-1">
            <p className="font-mono font-bold text-lg">{visit.truck.plateNumber}</p>
            <p className="text-sm text-charcoal/60">{visit.truck.driverName}</p>
          </div>
          <VisitTypeBadge type={visit.visitType} />
        </div>

        <div className="space-y-2 mb-4">
          <div className="flex justify-between text-sm">
            <span className="text-charcoal/60">Gate In</span>
            <span className="font-mono font-bold">{gateInTime}</span>
          </div>
          {visit.queuingMinutes !== null && (
            <div className="flex justify-between text-sm">
              <span className="text-charcoal/60">Queuing</span>
              <span className="font-mono">{visit.queuingMinutes} min</span>
            </div>
          )}
          {completedStages.map((s) => (
            <div key={s.key} className="flex justify-between text-sm">
              <span className="text-charcoal/60">{s.name}</span>
              <span className="font-mono">{s.event?.durationMinutes} min</span>
            </div>
          ))}
          <div className="flex justify-between text-base font-bold pt-2 border-t border-charcoal/20">
            <span>Total (estimate)</span>
            <span className="font-mono">
              {Math.round((Date.now() - new Date(visit.gateInAt).getTime()) / 60000)} min
            </span>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-alert text-red-alert rounded-xl p-4 mb-4 text-sm">
          {error}
        </div>
      )}

      {visit.status === 'ACTIVE' ? (
        <button
          onClick={doGateOut}
          disabled={submitting}
          className="w-full bg-charcoal text-paper py-5 rounded-xl font-bold text-xl active:scale-95 transition-all disabled:opacity-50"
        >
          {submitting ? 'Processing…' : 'Confirm Gate Out'}
        </button>
      ) : (
        <div className="bg-green-ok/10 border border-green-ok rounded-xl p-4 text-center">
          <p className="font-bold text-green-800">Gated Out</p>
          <p className="text-sm text-charcoal/60">
            at {visit.gateOutAt ? fmt(visit.gateOutAt) : '—'} · Total: {visit.totalMinutes} min
          </p>
        </div>
      )}
    </div>
  );
}
