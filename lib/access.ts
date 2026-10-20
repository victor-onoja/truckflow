// Single source of truth for which roles may open which pages.
// Used by proxy.ts (enforcement) and the nav (visibility).

export const ALL_ROLES = [
  'GATE_OFFICER',
  'YARD_OPERATOR',
  'FUELING_STAFF',
  'SUPERVISOR',
  'DISTRIBUTION_LEAD',
  'ADMIN',
] as const;

export const FIELD_ROLES = ['GATE_OFFICER', 'YARD_OPERATOR', 'FUELING_STAFF', 'ADMIN'];
export const OVERSIGHT_ROLES = ['SUPERVISOR', 'DISTRIBUTION_LEAD', 'ADMIN'];

export const ROLE_LABELS: Record<string, string> = {
  GATE_OFFICER: 'Gate officer',
  YARD_OPERATOR: 'Yard operator',
  FUELING_STAFF: 'Fueling staff',
  SUPERVISOR: 'Supervisor',
  DISTRIBUTION_LEAD: 'Distribution lead',
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
  if (role === 'SUPERVISOR' || role === 'DISTRIBUTION_LEAD') return '/dashboard';
  return '/queue';
}
