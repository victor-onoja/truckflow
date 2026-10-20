'use client';
import { useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { ChevronRight, CircleCheck } from 'lucide-react';
import VisitTypeBadge from '@/components/VisitTypeBadge';
import StagePill from '@/components/StagePill';
import StageTimesChart from '@/components/StageTimesChart';
import TctChart from '@/components/TctChart';
import { useTargets } from '@/hooks/useTargets';
import { useLiveQueue } from '@/hooks/useLiveQueue';
import { fmtMinutes, fmtTime } from '@/lib/client-types';

type HistoryVisit = {
  id: string;
  visitType: string;
  gateInAt: string;
  gateOutAt: string | null;
  totalMinutes: number | null;
  queuingMinutes: number | null;
  truck: { plateNumber: string; driverName: string };
};

type Summary = {
  onSite: number;
  overdue: number;
  runningLong: number;
  overTct: number;
  completedToday: number;
  avgTurnaroundToday: number | null;
};

const fetcher = (url: string) => fetch(url).then((r) => r.json()).then((j) => (j.ok ? j.data : null));

function Stat({ label, value, note, tone }: { label: string; value: string; note?: string; tone?: 'danger' }) {
  return (
    <div className="bg-surface px-4 py-3 min-w-0">
      <dt className="text-sm text-ink-2">{label}</dt>
      <dd className={`text-2xl font-semibold tnum mt-0.5 ${tone === 'danger' ? 'text-danger' : ''}`}>{value}</dd>
      {note && <dd className="text-xs text-ink-2 mt-0.5 truncate">{note}</dd>}
    </div>
  );
}

const inputCls =
  'w-full min-h-11 rounded-lg border-2 border-line bg-surface px-3 text-sm focus:border-amber-ink focus:outline-none';

export default function DashboardPage() {
  const [filters, setFilters] = useState({ dateFrom: '', dateTo: '', visitType: '' });
  const params = new URLSearchParams(Object.entries(filters).filter(([, v]) => v));
  const range = new URLSearchParams({ ...(filters.dateFrom && { dateFrom: filters.dateFrom }), ...(filters.dateTo && { dateTo: filters.dateTo }) });

  const { queue } = useLiveQueue();
  const { targets } = useTargets();
  const { data: summary } = useSWR<Summary>('/api/analytics/summary', fetcher, { refreshInterval: 15000 });
  const { data: history, isLoading: historyLoading } = useSWR<HistoryVisit[]>(`/api/history?${params}`, fetcher);
  const { data: averages } = useSWR<Record<string, Record<string, number | null>>>(`/api/analytics/stage-averages?${range}`, fetcher);

  const attention = queue
    .filter((q) => q.health !== 'ok')
    .sort((a, b) => (a.health === b.health ? (b.minutesInStep ?? 0) - (a.minutesInStep ?? 0) : a.health === 'over' ? -1 : 1));
  const filtered = Object.values(filters).some(Boolean);

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight mb-4">TCT overview</h1>

      <dl className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-line rounded-2xl overflow-hidden shadow-card mb-6">
        <Stat label="In plant now" value={summary ? String(summary.onSite) : '—'} note={summary?.overTct ? `${summary.overTct} over TCT limit` : summary?.runningLong ? `${summary.runningLong} running long` : undefined} />
        <Stat label="Overdue" value={summary ? String(summary.overdue) : '—'} tone={summary?.overdue ? 'danger' : undefined} note="past the red limit" />
        <Stat label="Out today" value={summary ? String(summary.completedToday) : '—'} />
        <Stat label="Avg TCT today" value={fmtMinutes(summary?.avgTurnaroundToday)} note="gate in to gate out" />
      </dl>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
        <div className="space-y-6">
          <section aria-labelledby="att-h">
            <h2 id="att-h" className="text-lg font-semibold mb-3">Needs attention</h2>
            {attention.length === 0 ? (
              <p className="flex items-center gap-2 rounded-2xl bg-ok-wash text-ok px-4 py-3.5 font-medium">
                <CircleCheck className="size-5" aria-hidden /> Every truck in the plant is within target.
              </p>
            ) : (
              <ul className="bg-surface rounded-2xl shadow-card divide-y divide-line">
                {attention.map((q) => (
                  <li key={q.id}>
                    <Link href={`/visit/${q.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-charcoal/[0.02]">
                      <span className="flex-1 min-w-0">
                        <span className="font-mono font-semibold">{q.truckPlate}</span>
                        <span className="block text-xs text-ink-2 truncate">{q.driverName}</span>
                      </span>
                      <StagePill label={q.statusLabel} minutes={q.minutesInStep} health={q.health} />
                      <ChevronRight className="size-4 text-ink-2 shrink-0" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="tct-h" className="bg-surface rounded-2xl shadow-card p-5">
            <h2 id="tct-h" className="text-lg font-semibold">TCT by visit type</h2>
            <p className="text-sm text-ink-2 mb-4">
              Average gate in to gate out · {filters.dateFrom || filters.dateTo ? 'selected dates' : 'all completed visits'}
            </p>
            {averages ? <TctChart averages={averages} targets={targets} /> : <div className="h-32 rounded-xl bg-charcoal/[0.05] animate-pulse" />}
          </section>

          <section aria-labelledby="times-h" className="bg-surface rounded-2xl shadow-card p-5">
            <h2 id="times-h" className="text-lg font-semibold">Average stage times</h2>
            <p className="text-sm text-ink-2 mb-4">{filters.dateFrom || filters.dateTo ? 'Selected dates' : 'All completed visits'}</p>
            {averages ? <StageTimesChart averages={averages} targets={targets} /> : <div className="h-48 rounded-xl bg-charcoal/[0.05] animate-pulse" />}
          </section>
        </div>

        <section aria-labelledby="hist-h">
          <h2 id="hist-h" className="text-lg font-semibold mb-3">Completed visits</h2>
          <div className="grid grid-cols-3 gap-2 mb-3">
            <label className="text-xs font-semibold text-ink-2">
              From
              <input type="date" value={filters.dateFrom} onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })} className={`${inputCls} mt-1`} />
            </label>
            <label className="text-xs font-semibold text-ink-2">
              To
              <input type="date" value={filters.dateTo} onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })} className={`${inputCls} mt-1`} />
            </label>
            <label className="text-xs font-semibold text-ink-2">
              Type
              <select value={filters.visitType} onChange={(e) => setFilters({ ...filters, visitType: e.target.value })} className={`${inputCls} mt-1`}>
                <option value="">All</option>
                <option value="FULL_CYCLE">Full cycle</option>
                <option value="OFFLOAD_ONLY">Offload only</option>
                <option value="LOAD_ONLY">Load only</option>
              </select>
            </label>
          </div>
          {filtered && (
            <button onClick={() => setFilters({ dateFrom: '', dateTo: '', visitType: '' })} className="mb-3 min-h-11 text-sm font-semibold text-amber-ink hover:underline">
              Clear filters
            </button>
          )}

          <div className="bg-surface rounded-2xl shadow-card overflow-hidden">
            {historyLoading && <div className="h-40 animate-pulse bg-charcoal/[0.04]" />}
            {!historyLoading && (history?.length ?? 0) === 0 && (
              <p className="px-4 py-8 text-center text-ink-2">{filtered ? 'No visits match these filters.' : 'No completed visits yet.'}</p>
            )}
            <ul className="divide-y divide-line">
              {history?.map((v) => (
                <li key={v.id}>
                  <Link href={`/visit/${v.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-charcoal/[0.02]">
                    <span className="flex-1 min-w-0">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-mono font-semibold">{v.truck.plateNumber}</span>
                        <VisitTypeBadge type={v.visitType} />
                      </span>
                      <span className="block text-xs text-ink-2 tnum mt-0.5">
                        {v.gateOutAt && new Date(v.gateOutAt).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })} · {fmtTime(v.gateInAt)}–{fmtTime(v.gateOutAt)}
                      </span>
                    </span>
                    <span className="text-right shrink-0">
                      <span className="block font-semibold tnum">{fmtMinutes(v.totalMinutes)}</span>
                      <span className="block text-xs text-ink-2">TCT</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}
