'use client';
import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import VisitTypeBadge from '@/components/VisitTypeBadge';
import { STAGE_ROLE_PERMISSIONS, STAGES, StageKey } from '@/lib/stages';

type StageEntry = {
  key: StageKey;
  name: string;
  num: number;
  capture: string;
  event: { id: string; startAt: string; endAt: string | null; durationMinutes: number | null } | null;
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

function useStopwatch(startAt: string | null | undefined) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!startAt) return;
    const tick = () => setElapsed(Math.floor((Date.now() - new Date(startAt).getTime()) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startAt]);
  const m = Math.floor(elapsed / 60);
  const s = elapsed % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function StageRow({
  entry,
  visitId,
  userRole,
  onAction,
}: {
  entry: StageEntry;
  visitId: string;
  userRole: string;
  onAction: () => void;
}) {
  const [notes, setNotes] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const canAct = STAGE_ROLE_PERMISSIONS[entry.key].includes(userRole);
  const isStarted = !!entry.event?.startAt;
  const isEnded = !!entry.event?.endAt;
  const isInProgress = isStarted && !isEnded;
  const stopwatch = useStopwatch(isInProgress ? entry.event?.startAt : null);

  const doStart = async () => {
    setLoading(true); setError('');
    const r = await fetch(`/api/visits/${visitId}/stage/start`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stageKey: entry.key, notes }),
    });
    const j = await r.json();
    setLoading(false);
    if (!j.ok) setError(j.error);
    else { setNotes(''); onAction(); }
  };

  const doEnd = async () => {
    setLoading(true); setError('');
    const r = await fetch(`/api/visits/${visitId}/stage/end`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stageKey: entry.key, notes }),
    });
    const j = await r.json();
    setLoading(false);
    if (!j.ok) setError(j.error);
    else { setNotes(''); setConfirm(false); onAction(); }
  };

  if (entry.capture === 'INSTANT') {
    const ts = entry.event?.startAt ? new Date(entry.event.startAt).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' }) : null;
    return (
      <div className={`flex items-center gap-3 py-3 border-b border-charcoal/10 ${entry.key === 'GATE_OUT' ? 'opacity-50' : ''}`}>
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${ts ? 'bg-green-ok text-white' : 'bg-charcoal/20 text-charcoal/40'}`}>
          {entry.num}
        </div>
        <div className="flex-1">
          <p className="font-semibold">{entry.name}</p>
          {ts && <p className="text-xs font-mono text-charcoal/50">{ts}</p>}
        </div>
        {ts && <span className="text-green-ok">✓</span>}
      </div>
    );
  }

  if (entry.capture === 'DERIVED') {
    return (
      <div className="flex items-center gap-3 py-3 border-b border-charcoal/10">
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold bg-charcoal/20 text-charcoal/40 flex-shrink-0">
          {entry.num}
        </div>
        <div className="flex-1">
          <p className="font-semibold">{entry.name}</p>
          <p className="text-xs text-charcoal/40">Automatically computed</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`py-3 border-b border-charcoal/10 ${isEnded ? 'opacity-60' : ''}`}>
      <div className="flex items-center gap-3">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${isEnded ? 'bg-green-ok text-white' : isInProgress ? 'bg-amber text-charcoal' : 'bg-charcoal/20 text-charcoal/40'}`}>
          {isEnded ? '✓' : entry.num}
        </div>
        <div className="flex-1">
          <p className="font-semibold">{entry.name}</p>
          {isInProgress && <p className="text-sm font-mono text-amber font-bold">{stopwatch}</p>}
          {isEnded && entry.event?.durationMinutes != null && (
            <p className="text-xs font-mono text-charcoal/50">Took {entry.event.durationMinutes} min</p>
          )}
        </div>

        {canAct && !isStarted && (
          <button
            onClick={doStart}
            disabled={loading}
            className="bg-green-ok text-white px-5 py-2.5 rounded-xl font-bold min-h-[48px] active:scale-95 transition-all disabled:opacity-50"
          >
            {loading ? '…' : 'START'}
          </button>
        )}

        {canAct && isInProgress && !confirm && (
          <button
            onClick={() => setConfirm(true)}
            className="bg-red-alert text-white px-5 py-2.5 rounded-xl font-bold min-h-[48px] active:scale-95 transition-all"
          >
            END
          </button>
        )}

        {isEnded && <span className="text-green-ok text-sm font-bold">Done</span>}
      </div>

      {canAct && !isEnded && (
        <div className="ml-11 mt-2">
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes (optional)"
            className="w-full text-sm border border-charcoal/20 rounded-lg px-3 py-2 focus:border-amber focus:outline-none"
          />
        </div>
      )}

      {confirm && (
        <div className="ml-11 mt-3 bg-red-50 border border-red-alert rounded-xl p-4">
          <p className="font-bold text-red-alert mb-3">End {entry.name}?</p>
          <div className="flex gap-3">
            <button onClick={doEnd} disabled={loading} className="flex-1 bg-red-alert text-white py-3 rounded-lg font-bold">
              {loading ? '…' : 'Confirm End'}
            </button>
            <button onClick={() => setConfirm(false)} className="flex-1 border border-charcoal/30 py-3 rounded-lg font-bold">
              Cancel
            </button>
          </div>
        </div>
      )}

      {error && <p className="ml-11 mt-2 text-red-alert text-sm">{error}</p>}
    </div>
  );
}

export default function VisitPage() {
  const { id } = useParams<{ id: string }>();
  const [visit, setVisit] = useState<VisitDetail | null>(null);
  const [userRole, setUserRole] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [vRes, meRes] = await Promise.all([
      fetch(`/api/visits/${id}`),
      fetch('/api/auth/me'),
    ]);
    const [vj, mj] = await Promise.all([vRes.json(), meRes.json()]);
    if (vj.ok) setVisit(vj.data);
    if (mj.ok) setUserRole(mj.data.role);
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="py-8 text-center text-charcoal/40">Loading…</div>;
  if (!visit) return <div className="py-8 text-center text-red-alert">Visit not found</div>;

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <Link href="/queue" className="text-charcoal/40 hover:text-charcoal">←</Link>
        <span className="font-mono font-bold text-lg">{visit.truck.plateNumber}</span>
        <VisitTypeBadge type={visit.visitType} />
      </div>

      <p className="text-sm text-charcoal/60 mb-4">{visit.truck.driverName}</p>

      <div className="bg-white rounded-2xl shadow-sm p-4 mb-4">
        <h3 className="font-bold text-sm uppercase tracking-wide text-charcoal/50 mb-3">Stage Progress</h3>
        <div className="divide-y divide-charcoal/5">
          {visit.sequence.map((s) => (
            <StageRow
              key={s.key}
              entry={s}
              visitId={visit.id}
              userRole={userRole}
              onAction={load}
            />
          ))}
        </div>
      </div>

      {visit.gateOutReady && visit.status === 'ACTIVE' && (
        <Link
          href={`/visit/${visit.id}/gate-out`}
          className="block w-full bg-charcoal text-paper text-center py-4 rounded-xl font-bold text-lg"
        >
          Proceed to Gate Out →
        </Link>
      )}

      {visit.status === 'COMPLETED' && (
        <div className="bg-green-ok/10 border border-green-ok rounded-xl p-4 text-center">
          <p className="font-bold text-green-800">Visit Complete</p>
          <p className="text-sm text-charcoal/60">Total: {visit.totalMinutes} min</p>
        </div>
      )}
    </div>
  );
}
