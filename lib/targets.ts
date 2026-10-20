// Plant time targets, in minutes. Client-safe: no database access here.
// `target` = where a step starts running long (amber); `limit` = overdue (red).
// Admins edit these on the Admin → Targets tab; stored rows override the defaults.

export type TimeTarget = { target: number; limit: number };
export type Targets = Record<string, TimeTarget>;
export type TargetHealth = 'ok' | 'warn' | 'over';

export const TARGET_GROUPS: Array<{ title: string; hint: string; items: Array<{ key: string; label: string }> }> = [
  {
    title: 'Turnaround (TCT)',
    hint: 'Gate in to gate out, per visit type',
    items: [
      { key: 'TCT_FULL_CYCLE', label: 'Full cycle' },
      { key: 'TCT_OFFLOAD_ONLY', label: 'Offload only' },
      { key: 'TCT_LOAD_ONLY', label: 'Load only' },
    ],
  },
  {
    title: 'Stages',
    hint: 'Time spent in each stage',
    items: [
      { key: 'QUEUING', label: 'Queuing' },
      { key: 'UNLATCHING', label: 'Unlatching' },
      { key: 'OFFLOADING', label: 'Offloading' },
      { key: 'LOADING', label: 'Loading' },
      { key: 'LATCHING', label: 'Latching' },
      { key: 'FUELING', label: 'Fueling' },
    ],
  },
];

export const TARGET_KEYS = TARGET_GROUPS.flatMap((g) => g.items.map((i) => i.key));

export const DEFAULT_TARGETS: Targets = {
  TCT_FULL_CYCLE: { target: 180, limit: 240 },
  TCT_OFFLOAD_ONLY: { target: 90, limit: 120 },
  TCT_LOAD_ONLY: { target: 120, limit: 150 },
  QUEUING: { target: 30, limit: 60 },
  UNLATCHING: { target: 10, limit: 20 },
  OFFLOADING: { target: 45, limit: 90 },
  LOADING: { target: 45, limit: 90 },
  LATCHING: { target: 10, limit: 20 },
  FUELING: { target: 20, limit: 40 },
};

export const tctKey = (visitType: string) => `TCT_${visitType}`;

export function healthFor(t: TimeTarget | undefined, minutes: number | null): TargetHealth {
  if (!t || minutes == null) return 'ok';
  if (minutes >= t.limit) return 'over';
  if (minutes >= t.target) return 'warn';
  return 'ok';
}
