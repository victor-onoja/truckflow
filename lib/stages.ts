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

export const THRESHOLDS_MIN: Record<string, { amber: number; red: number }> = {
  QUEUING:    { amber: 30, red: 60 },
  UNLATCHING: { amber: 10, red: 20 },
  OFFLOADING: { amber: 45, red: 90 },
  LOADING:    { amber: 45, red: 90 },
  LATCHING:   { amber: 10, red: 20 },
  FUELING:    { amber: 20, red: 40 },
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

export function getActionableStages(visitType: VisitType): StageKey[] {
  return VISIT_SEQUENCES[visitType].filter(
    (k) => STAGES[k].capture === 'START_END'
  );
}

export function diffMinutes(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 60000);
}
