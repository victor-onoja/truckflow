// Single source of truth for which roles may open which pages.
// Used by proxy.ts (enforcement) and the nav (visibility).

export const ALL_ROLES = [
  'GATE_OFFICER',
  'FORKLIFT_OPERATOR',
  'FUELING_STAFF',
  'SUPERVISOR',
  'ADMIN',
] as const;

export const FIELD_ROLES = ['GATE_OFFICER', 'FORKLIFT_OPERATOR', 'FUELING_STAFF', 'ADMIN'];
export const OVERSIGHT_ROLES = ['SUPERVISOR', 'ADMIN'];

export const ROLE_LABELS: Record<string, string> = {
  GATE_OFFICER: 'Gate officer',
  FORKLIFT_OPERATOR: 'Forklift operator',
  FUELING_STAFF: 'Fueling staff',
  SUPERVISOR: 'Supervisor',
  ADMIN: 'Admin',
};

// Most specific prefix first. Paths not listed are open to any signed-in user.
const PAGE_ACCESS: Array<{ prefix: string; roles: string[] }> = [
  { prefix: '/admin', roles: ['ADMIN'] },
  { prefix: '/dashboard', roles: OVERSIGHT_ROLES },
  { prefix: '/scan', roles: FIELD_ROLES },
];

export function canOpenPage(path: string, role: string): boolean {
  const rule = PAGE_ACCESS.find((r) => path === r.prefix || path.startsWith(`${r.prefix}/`));
  return !rule || rule.roles.includes(role);
}

export function homeFor(role: string): string {
  if (role === 'SUPERVISOR') return '/dashboard';
  return '/queue';
}
