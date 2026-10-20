import { AlertTriangle } from 'lucide-react';
import { VISIT_TYPE_LABELS, VISIT_TYPE_SWATCH } from './VisitTypeBadge';
import type { Targets } from '@/lib/targets';
import { fmtMinutes } from '@/lib/client-types';

type Averages = Record<string, Record<string, number | null>>;

const STAGES: Array<[string, string]> = [
  ['QUEUING', 'Queuing'],
  ['UNLATCHING', 'Unlatching'],
  ['OFFLOADING', 'Offloading'],
  ['LOADING', 'Loading'],
  ['LATCHING', 'Latching'],
  ['FUELING', 'Fueling'],
];
const TYPES = ['FULL_CYCLE', 'OFFLOAD_ONLY', 'LOAD_ONLY'];
const SHORT: Record<string, string> = { FULL_CYCLE: 'Full', OFFLOAD_ONLY: 'Offload', LOAD_ONLY: 'Load' };

/**
 * Bullet rows: per stage, one thin bar per visit type (average minutes) against
 * a target tick. Every bar is direct-labelled with type and value, so identity
 * never rests on colour alone; a table view is one tap away.
 */
export default function StageTimesChart({ averages, targets }: { averages: Averages; targets: Targets }) {
  const rows = STAGES.map(([key, name]) => ({
    key,
    name,
    target: targets[key]?.target ?? null,
    bars: TYPES.filter((t) => averages[t]?.[key] != null).map((t) => ({ type: t, value: averages[t][key] as number })),
  })).filter((r) => r.bars.length > 0);

  if (rows.length === 0) {
    return <p className="text-ink-2 py-6">No completed visits in this period yet. Stage times appear after the first gate out.</p>;
  }

  const max = Math.max(...rows.flatMap((r) => [...r.bars.map((b) => b.value), r.target ?? 0])) * 1.15;
  const pct = (v: number) => `${(v / max) * 100}%`;
  const present = TYPES.filter((t) => rows.some((r) => r.bars.some((b) => b.type === t)));

  return (
    <div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 mb-4 text-sm text-ink-2" aria-label="Legend">
        {present.map((t) => (
          <li key={t} className="inline-flex items-center gap-1.5">
            <span className={`size-2.5 rounded-[2px] ${VISIT_TYPE_SWATCH[t]}`} aria-hidden />
            {VISIT_TYPE_LABELS[t]}
          </li>
        ))}
        <li className="inline-flex items-center gap-1.5">
          <span className="w-0.5 h-3.5 bg-charcoal" aria-hidden /> Target
        </li>
      </ul>

      <ol className="space-y-5">
        {rows.map((r) => (
          <li key={r.key}>
            <div className="flex items-baseline justify-between gap-2 mb-1.5">
              <span className="font-semibold">{r.name}</span>
              {r.target != null && <span className="text-xs text-ink-2 tnum">target {fmtMinutes(r.target)}</span>}
            </div>
            <div className="relative space-y-0.5">
              {r.bars.map((b) => {
                const over = r.target != null && b.value > r.target;
                return (
                  <div key={b.type} className="flex items-center gap-2" title={`${VISIT_TYPE_LABELS[b.type]}: ${fmtMinutes(b.value)} average`}>
                    <div className="relative flex-1 h-3">
                      <div
                        className={`absolute inset-y-0 left-0 rounded-r-[4px] ${VISIT_TYPE_SWATCH[b.type]}`}
                        style={{ width: pct(b.value) }}
                      />
                    </div>
                    <span className={`w-28 shrink-0 text-xs tnum whitespace-nowrap inline-flex items-center gap-1 ${over ? 'text-danger font-semibold' : 'text-ink-2'}`}>
                      {over && <AlertTriangle className="size-3" aria-label="over target" />}
                      {SHORT[b.type]} {fmtMinutes(b.value)}
                    </span>
                  </div>
                );
              })}
              {r.target != null && (
                <span
                  className="absolute -top-0.5 -bottom-0.5 w-0.5 bg-charcoal rounded-full pointer-events-none"
                  style={{ left: `calc((100% - 7.5rem) * ${r.target / max})` }}
                  aria-hidden
                />
              )}
            </div>
          </li>
        ))}
      </ol>

      <details className="mt-5">
        <summary className="cursor-pointer text-sm font-semibold text-amber-ink min-h-11 inline-flex items-center">Show as table</summary>
        <div className="overflow-x-auto">
          <table className="w-full text-sm tnum mt-2">
            <thead>
              <tr className="text-left text-ink-2">
                <th className="py-2 pr-3 font-medium">Stage</th>
                {present.map((t) => <th key={t} className="py-2 pr-3 font-medium">{VISIT_TYPE_LABELS[t]}</th>)}
                <th className="py-2 font-medium">Target</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key} className="border-t border-line">
                  <td className="py-2 pr-3 font-medium">{r.name}</td>
                  {present.map((t) => <td key={t} className="py-2 pr-3">{fmtMinutes(averages[t]?.[r.key] ?? null)}</td>)}
                  <td className="py-2">{fmtMinutes(r.target)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
