// Visit types are identities, not states: each gets a categorical swatch,
// and the text stays in ink so it reads regardless of the hue.
const TYPES: Record<string, { label: string; swatch: string }> = {
  FULL_CYCLE:   { label: 'Full cycle',   swatch: 'bg-type-full' },
  OFFLOAD_ONLY: { label: 'Offload only', swatch: 'bg-type-offload' },
  LOAD_ONLY:    { label: 'Load only',    swatch: 'bg-type-load' },
};

export const VISIT_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(TYPES).map(([k, v]) => [k, v.label])
);

export const VISIT_TYPE_SWATCH: Record<string, string> = Object.fromEntries(
  Object.entries(TYPES).map(([k, v]) => [k, v.swatch])
);

export default function VisitTypeBadge({ type }: { type: string }) {
  const { label, swatch } = TYPES[type] ?? { label: type, swatch: 'bg-ink-2' };
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-md whitespace-nowrap bg-charcoal/[0.06] text-charcoal">
      <span className={`size-2 rounded-[2px] ${swatch}`} aria-hidden />
      {label}
    </span>
  );
}
