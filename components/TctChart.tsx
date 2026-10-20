import { AlertTriangle } from 'lucide-react';
import { VISIT_TYPE_LABELS, VISIT_TYPE_SWATCH } from './VisitTypeBadge';
import { tctKey, type Targets } from '@/lib/targets';
import { fmtMinutes } from '@/lib/client-types';

const TYPES = ['FULL_CYCLE', 'OFFLOAD_ONLY', 'LOAD_ONLY'];

/**
 * Average turnaround (gate in → gate out) per visit type against its target
 * tick and limit band. Own scale, separate from stage times, so long TCTs don't
 * flatten the stage bars. Values are printed, so colour never carries meaning alone.
 */
export default function TctChart({ averages, targets }: { averages: Record<string, Record<string, number | null>>; targets: Targets }) {
  const rows = TYPES.map((t) => ({ type: t, avg: averages[t]?.TCT ?? null, goal: targets[tctKey(t)] }));
  const max = Math.max(...rows.flatMap((r) => [r.avg ?? 0, r.goal?.limit ?? 0])) * 1.1 || 1;
  const pct = (v: number) => `${(v / max) * 100}%`;

  return (
    <ul className="space-y-5">
      {rows.map(({ type, avg, goal }) => {
        const state = !goal || avg == null ? 'none' : avg >= goal.limit ? 'over' : avg >= goal.target ? 'warn' : 'ok';
        return (
          <li key={type}>
            <div className="flex items-baseline justify-between gap-2 mb-1.5">
              <span className="inline-flex items-center gap-2 font-semibold">
                <span className={`size-2.5 rounded-[2px] ${VISIT_TYPE_SWATCH[type]}`} aria-hidden />
                {VISIT_TYPE_LABELS[type]}
              </span>
              <span
                className={`inline-flex items-center gap-1 text-sm tnum ${
                  state === 'over' ? 'text-danger font-semibold' : state === 'warn' ? 'text-amber-ink font-semibold' : 'text-charcoal font-semibold'
                }`}
              >
                {(state === 'over' || state === 'warn') && <AlertTriangle className="size-3.5" aria-hidden />}
                {avg == null ? <span className="text-ink-2 font-normal">no visits yet</span> : `avg ${fmtMinutes(avg)}`}
              </span>
            </div>
            <div className="relative h-3 rounded-r-[4px]">
              {goal && (
                <span
                  className="absolute inset-y-0 rounded-r-[4px] bg-danger-wash"
                  style={{ left: pct(goal.limit), right: 0 }}
                  aria-hidden
                />
              )}
              {avg != null && (
                <span className={`absolute inset-y-0 left-0 rounded-r-[4px] ${VISIT_TYPE_SWATCH[type]}`} style={{ width: pct(avg) }} aria-hidden />
              )}
              {goal && (
                <span className="absolute -inset-y-1 w-0.5 rounded-full bg-charcoal" style={{ left: pct(goal.target) }} aria-hidden />
              )}
            </div>
            {goal && (
              <p className="mt-1 text-xs text-ink-2 tnum">
                target {fmtMinutes(goal.target)} · limit {fmtMinutes(goal.limit)}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
