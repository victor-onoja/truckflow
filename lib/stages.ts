export type StageKey =
  | 'GATE_IN'
  | 'QUEUING'
  | 'UNLATCHING'
  | 'OFFLOADING'
  | 'LOADING'
  | 'LATCHING'
  | 'FUELING'
  | 'GATE_OUT';

export type VisitType = 'FULL_CYCLE' | 'OFFLOAD_ONLY' | 'LOAD_ONLY';
export type CaptureType = 'INSTANT' | 'DERIVED' | 'START_END';

export const STAGES: Record<StageKey, { num: number; name: string; capture: CaptureType }> = {
  GATE_IN:    { num: 1, name: 'Gate In',    capture: 'INSTANT' },
  QUEUING:    { num: 2, name: 'Queuing',    capture: 'DERIVED' },
  UNLATCHING: { num: 3, name: 'Unlatching', capture: 'START_END' },
  OFFLOADING: { num: 4, name: 'Offloading', capture: 'START_END' },
  LOADING:    { num: 5, name: 'Loading',    capture: 'START_END' },
  LATCHING:   { num: 6, name: 'Latching',   capture: 'START_END' },
  FUELING:    { num: 7, name: 'Fueling',    capture: 'START_END' },
  GATE_OUT:   { num: 8, name: 'Gate Out',   capture: 'INSTANT' },
};

export const VISIT_SEQUENCES: Record<VisitType, StageKey[]> = {
  FULL_CYCLE:   ['GATE_IN', 'QUEUING', 'UNLATCHING', 'OFFLOADING', 'LOADING', 'LATCHING', 'FUELING', 'GATE_OUT'],
  OFFLOAD_ONLY: ['GATE_IN', 'QUEUING', 'UNLATCHING', 'OFFLOADING', 'GATE_OUT'],
  LOAD_ONLY:    ['GATE_IN', 'QUEUING', 'LOADING', 'LATCHING', 'FUELING', 'GATE_OUT'],
};

// Role permission map: which roles may act on which stage keys
export const STAGE_ROLE_PERMISSIONS: Record<StageKey, string[]> = {
  GATE_IN:    ['GATE_OFFICER', 'ADMIN'],
  QUEUING:    [],
  UNLATCHING: ['YARD_OPERATOR', 'ADMIN'],
  OFFLOADING: ['YARD_OPERATOR', 'ADMIN'],
  LOADING:    ['YARD_OPERATOR', 'ADMIN'],
  LATCHING:   ['YARD_OPERATOR', 'ADMIN'],
  FUELING:    ['FUELING_STAFF', 'ADMIN'],
  GATE_OUT:   ['GATE_OFFICER', 'ADMIN'],
};

// Physically back-to-back stages done by the same crew at the same bay.
// Finishing the first starts the second in one action, so the operator taps once.
// Offloading → Loading is deliberately NOT chained: the truck usually moves bays
// and that gap is real waiting time that must not be counted as loading.
export const CHAINED_NEXT: Partial<Record<StageKey, StageKey>> = {
  UNLATCHING: 'OFFLOADING',
  LOADING: 'LATCHING',
};

// How long an action can be taken back after it was recorded.
export const UNDO_WINDOW_MS = 2 * 60_000;

export function getActionableStages(visitType: VisitType): StageKey[] {
  return VISIT_SEQUENCES[visitType].filter(
    (k) => STAGES[k].capture === 'START_END'
  );
}

export function diffMinutes(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 60000);
}
