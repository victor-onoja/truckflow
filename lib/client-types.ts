// JSON shapes the client receives (Dates arrive as ISO strings).

export type NextAction =
  | { kind: 'START' | 'END'; stageKey: string; roles: string[]; chainsTo?: string; label: string }
  | { kind: 'GATE_OUT'; roles: string[]; label: string }
  | { kind: 'DONE'; label: string };

export type Health = 'ok' | 'warn' | 'over';

export type VisitSummary = {
  id: string;
  truckId: string;
  truckPlate: string;
  driverName: string;
  visitType: string;
  status: string;
  gateInAt: string;
  currentStage: string;
  statusLabel: string;
  inProgress: boolean;
  minutesInStep: number | null;
  health: Health;
  totalElapsed: number;
  /** Whole-visit turnaround target for this visit type, and how the visit is doing against it. */
  tct: { target: number; limit: number; health: Health } | null;
  queuingMinutes: number | null;
  next: NextAction;
};

export type QueueEntry = VisitSummary & { queuePosition: number };

export function canDo(next: NextAction, role: string): boolean {
  return next.kind !== 'DONE' && next.roles.includes(role);
}

export function fmtMinutes(min: number | null | undefined): string {
  if (min == null) return '—';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`;
}

export function fmtTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' });
}
