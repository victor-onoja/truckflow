import { AlertTriangle, Clock, CircleCheck, LogOut } from 'lucide-react';
import type { Health } from '@/lib/client-types';
import { fmtMinutes } from '@/lib/client-types';

const TONES: Record<Health, string> = {
  ok: 'bg-charcoal/[0.06] text-charcoal',
  warn: 'bg-amber-wash text-amber-ink',
  over: 'bg-danger text-white',
};

/** Where a truck is and for how long; colour is always paired with an icon and words. */
export default function StagePill({
  label,
  minutes,
  health,
  ready = false,
  done = false,
}: {
  label: string;
  minutes: number | null;
  health: Health;
  ready?: boolean;
  done?: boolean;
}) {
  const Icon = done ? CircleCheck : ready ? LogOut : health === 'ok' ? Clock : AlertTriangle;
  const tone = done || ready ? 'bg-ok-wash text-ok' : TONES[health];
  return (
    <span className={`inline-flex items-center gap-1.5 text-sm font-semibold px-2.5 py-1 rounded-lg whitespace-nowrap ${tone}`}>
      <Icon className="size-4 shrink-0" aria-hidden />
      <span>{label}</span>
      {minutes != null && !done && <span className="font-mono font-medium opacity-90">{fmtMinutes(minutes)}</span>}
      {health === 'over' && <span className="sr-only">(overdue)</span>}
      {health === 'warn' && <span className="sr-only">(running long)</span>}
    </span>
  );
}
