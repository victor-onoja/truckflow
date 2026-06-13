'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import VisitTypeBadge from '@/components/VisitTypeBadge';
import { THRESHOLDS_MIN } from '@/lib/stages';

type HistoryVisit = {
  id: string;
  visitType: string;
  status: string;
  gateInAt: string;
  gateOutAt: string | null;
  totalMinutes: number | null;
  queuingMinutes: number | null;
  truck: { plateNumber: string; driverName: string };
  events: Array<{ stageKey: string; durationMinutes: number | null }>;
};

type QueueEntry = {
  id: string;
  truckPlate: string;
  visitType: string;
  currentStageName: string;
  totalElapsed: number;
};

type Averages = Record<string, Record<string, number | null>>;

const STAGE_LABELS: Record<string, string> = {
  UNLATCHING: 'Unlatch',
  OFFLOADING: 'Offload',
  LOADING: 'Load',
  LATCHING: 'Latch',
  FUELING: 'Fuel',
  QUEUING: 'Queue',
};

export default function DashboardPage() {
  const [history, setHistory] = useState<HistoryVisit[]>([]);
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [averages, setAverages] = useState<Averages>({});
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ dateFrom: '', dateTo: '', visitType: '' });

  const load = async () => {
    const params = new URLSearchParams();
    if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
    if (filters.dateTo) params.set('dateTo', filters.dateTo);
    if (filters.visitType) params.set('visitType', filters.visitType);

    const [hRes, qRes, aRes] = await Promise.all([
      fetch(`/api/history?${params}`),
      fetch('/api/queue'),
      fetch('/api/analytics/stage-averages'),
    ]);

    const [hj, qj, aj] = await Promise.all([hRes.json(), qRes.json(), aRes.json()]);
    if (hj.ok) setHistory(hj.data);
    if (qj.ok) setQueue(qj.data);
    if (aj.ok) setAverages(aj.data);
    setLoading(false);
  };

  useEffect(() => { load(); }, [filters]);

  const completedToday = history.filter((v) => {
    if (!v.gateOutAt) return false;
    const d = new Date(v.gateOutAt);
    const today = new Date();
    return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate();
  });

  const avgTurnaround = completedToday.length
    ? Math.round(completedToday.reduce((s, v) => s + (v.totalMinutes ?? 0), 0) / completedToday.length)
    : null;

  const longest = queue.reduce((max, v) => (v.totalElapsed > (max?.totalElapsed ?? 0) ? v : max), null as QueueEntry | null);

  // Build chart data
  const stageKeys = ['QUEUING', 'UNLATCHING', 'OFFLOADING', 'LOADING', 'LATCHING', 'FUELING'];
  const chartData = stageKeys.map((sk) => {
    const row: Record<string, string | number | null> = { stage: STAGE_LABELS[sk] ?? sk };
    for (const vt of ['FULL_CYCLE', 'OFFLOAD_ONLY', 'LOAD_ONLY']) {
      row[vt] = averages[vt]?.[sk] ?? null;
    }
    return row;
  });

  // Find bottleneck — stage with highest ratio to threshold
  let bottleneck = '';
  let maxRatio = 0;
  for (const vt of Object.keys(averages)) {
    for (const [sk, avg] of Object.entries(averages[vt])) {
      const t = THRESHOLDS_MIN[sk];
      if (!t || avg == null) continue;
      const ratio = avg / t.amber;
      if (ratio > maxRatio) { maxRatio = ratio; bottleneck = `${STAGE_LABELS[sk] ?? sk} (avg ${avg}min vs ${t.amber}min target)`; }
    }
  }

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Dashboard</h2>

      {/* Metric tiles */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <p className="text-xs text-charcoal/50 uppercase tracking-wide font-semibold">On Site Now</p>
          <p className="text-3xl font-bold mt-1">{queue.length}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <p className="text-xs text-charcoal/50 uppercase tracking-wide font-semibold">Completed Today</p>
          <p className="text-3xl font-bold mt-1">{completedToday.length}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <p className="text-xs text-charcoal/50 uppercase tracking-wide font-semibold">Avg Turnaround</p>
          <p className="text-3xl font-bold mt-1">{avgTurnaround != null ? `${avgTurnaround}m` : '—'}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <p className="text-xs text-charcoal/50 uppercase tracking-wide font-semibold">Longest Active</p>
          <p className="text-lg font-bold mt-1 truncate">{longest ? `${longest.totalElapsed}m` : '—'}</p>
          {longest && <p className="text-xs font-mono text-charcoal/50 truncate">{longest.truckPlate}</p>}
        </div>
      </div>

      {/* Bottleneck */}
      {bottleneck && (
        <div className="bg-amber/10 border border-amber rounded-xl p-3 mb-4 flex items-start gap-2">
          <span className="text-amber text-lg">⚠️</span>
          <div>
            <p className="font-bold text-sm text-amber">Bottleneck</p>
            <p className="text-sm text-charcoal/70">{bottleneck}</p>
          </div>
        </div>
      )}

      {/* Stage averages chart */}
      <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
        <h3 className="font-bold text-sm uppercase tracking-wide text-charcoal/50 mb-3">Avg Stage Duration (min)</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#0f0e0c10" />
            <XAxis dataKey="stage" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 10 }} />
            <Bar dataKey="FULL_CYCLE" name="Full" fill="#c8860a" />
            <Bar dataKey="OFFLOAD_ONLY" name="Offload" fill="#2980b9" />
            <Bar dataKey="LOAD_ONLY" name="Load" fill="#27ae60" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl p-4 mb-4 shadow-sm">
        <h3 className="font-bold text-sm uppercase tracking-wide text-charcoal/50 mb-3">History Filters</h3>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <div>
            <label className="text-xs font-semibold text-charcoal/60">From</label>
            <input type="date" value={filters.dateFrom} onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
              className="w-full border border-charcoal/20 rounded-lg px-2 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs font-semibold text-charcoal/60">To</label>
            <input type="date" value={filters.dateTo} onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
              className="w-full border border-charcoal/20 rounded-lg px-2 py-2 text-sm" />
          </div>
        </div>
        <select value={filters.visitType} onChange={(e) => setFilters({ ...filters, visitType: e.target.value })}
          className="w-full border border-charcoal/20 rounded-lg px-2 py-2 text-sm">
          <option value="">All visit types</option>
          <option value="FULL_CYCLE">Full Cycle</option>
          <option value="OFFLOAD_ONLY">Offload Only</option>
          <option value="LOAD_ONLY">Load Only</option>
        </select>
      </div>

      {/* History table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-4">
        <div className="p-4 border-b border-charcoal/10">
          <h3 className="font-bold text-sm uppercase tracking-wide text-charcoal/50">Completed Visits</h3>
        </div>
        {loading && <div className="py-6 text-center text-charcoal/40 text-sm">Loading…</div>}
        {!loading && history.length === 0 && <div className="py-6 text-center text-charcoal/40 text-sm">No completed visits</div>}
        <div className="divide-y divide-charcoal/5">
          {history.map((v) => (
            <Link key={v.id} href={`/visit/${v.id}`} className="flex items-center gap-3 p-3 hover:bg-charcoal/5 transition-colors">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-mono font-bold text-sm">{v.truck.plateNumber}</span>
                  <VisitTypeBadge type={v.visitType} />
                </div>
                <p className="text-xs text-charcoal/50 font-mono">
                  {v.gateOutAt ? new Date(v.gateOutAt).toLocaleDateString('en-NG') : '—'}
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="font-mono font-bold text-sm">{v.totalMinutes}m</p>
                <p className="text-xs text-charcoal/40">total</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
