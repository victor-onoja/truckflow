'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ScanLine, Truck, WifiOff } from 'lucide-react';
import { useLiveQueue } from '@/hooks/useLiveQueue';
import { useMe } from '@/hooks/useMe';
import QueueRow from '@/components/QueueRow';
import { FIELD_ROLES } from '@/lib/access';
import { canDo, type QueueEntry } from '@/lib/client-types';

const SEVERITY = { over: 0, warn: 1, ok: 2 } as const;

function byUrgency(a: QueueEntry, b: QueueEntry) {
  return SEVERITY[a.health] - SEVERITY[b.health] || (b.minutesInStep ?? 0) - (a.minutesInStep ?? 0);
}

/** Seconds since the queue last refreshed, re-rendered every 5s. */
function useAge(updatedAt: number | null) {
  const [now, setNow] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(id);
  }, []);
  return updatedAt && now > updatedAt ? Math.round((now - updatedAt) / 1000) : 0;
}

export default function QueuePage() {
  const { queue, updatedAt, isLoading, error, refresh } = useLiveQueue();
  const me = useMe();
  const role = me?.role ?? '';
  const age = useAge(updatedAt);
  const isField = FIELD_ROLES.includes(role) && role !== 'ADMIN';

  const mine = isField ? queue.filter((e) => canDo(e.next, role)).sort(byUrgency) : [];
  const rest = isField ? queue.filter((e) => !canDo(e.next, role)) : [...queue].sort(byUrgency);
  const overdue = queue.filter((e) => e.health === 'over').length;

  return (
    <div className="max-w-xl mx-auto">
      <div className="flex items-end justify-between gap-3 mb-1">
        <h1 className="text-2xl font-bold tracking-tight">In the plant</h1>
        <p className="text-sm text-ink-2 tnum" aria-live="polite">
          {error ? (
            <span className="inline-flex items-center gap-1.5 text-danger font-medium">
              <WifiOff className="size-4" aria-hidden /> Offline, retrying
            </span>
          ) : (
            <>Updated {age < 5 ? 'just now' : `${age}s ago`}</>
          )}
        </p>
      </div>
      <p className="text-ink-2 mb-5 tnum">
        {queue.length} {queue.length === 1 ? 'truck' : 'trucks'}
        {overdue > 0 && <span className="text-danger font-semibold"> · {overdue} overdue</span>}
      </p>

      {isLoading && (
        <ul className="space-y-3" aria-hidden>
          {[0, 1, 2].map((i) => (
            <li key={i} className="h-32 rounded-2xl bg-charcoal/[0.05] animate-pulse" />
          ))}
        </ul>
      )}

      {!isLoading && queue.length === 0 && (
        <div className="rounded-2xl border-2 border-dashed border-line-strong px-6 py-12 text-center">
          <Truck className="size-10 mx-auto text-ink-2" strokeWidth={1.5} aria-hidden />
          <p className="font-semibold text-lg mt-3">No trucks in the plant</p>
          <p className="text-ink-2 mt-1">
            {role === 'GATE_OFFICER' || role === 'ADMIN'
              ? 'Scan a truck’s QR code at the gate to start its visit.'
              : 'Trucks appear here the moment the gate checks them in.'}
          </p>
          {(role === 'GATE_OFFICER' || role === 'ADMIN') && (
            <Link href="/scan" className="mt-5 inline-flex items-center gap-2 min-h-14 px-6 rounded-xl bg-amber font-semibold hover:bg-amber-light">
              <ScanLine className="size-5" aria-hidden /> Scan a truck
            </Link>
          )}
        </div>
      )}

      {isField && queue.length > 0 && (
        <section aria-labelledby="mine-h" className="mb-8">
          <h2 id="mine-h" className="text-lg font-semibold mb-3">
            Your turn <span className="text-ink-2 font-normal tnum">({mine.length})</span>
          </h2>
          {mine.length === 0 ? (
            <p className="text-ink-2 rounded-2xl bg-surface px-4 py-5">Nothing waiting on you right now.</p>
          ) : (
            <ul className="space-y-3">
              {mine.map((e) => (
                <QueueRow key={e.id} entry={e} role={role} showAction onChanged={() => refresh()} />
              ))}
            </ul>
          )}
        </section>
      )}

      {rest.length > 0 && (
        <section aria-labelledby={isField ? 'rest-h' : undefined}>
          {isField && (
            <h2 id="rest-h" className="text-lg font-semibold mb-3">
              Elsewhere in the plant <span className="text-ink-2 font-normal tnum">({rest.length})</span>
            </h2>
          )}
          <ul className="space-y-3">
            {rest.map((e) => (
              <QueueRow key={e.id} entry={e} role={role} showAction={role === 'ADMIN'} onChanged={() => refresh()} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
