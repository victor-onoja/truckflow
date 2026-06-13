export default function VisitTypeBadge({ type }: { type: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    FULL_CYCLE:   { label: 'FULL',    cls: 'bg-amber text-charcoal' },
    OFFLOAD_ONLY: { label: 'OFFLOAD', cls: 'bg-blue-600 text-white' },
    LOAD_ONLY:    { label: 'LOAD',    cls: 'bg-green-600 text-white' },
  };
  const { label, cls } = map[type] ?? { label: type, cls: 'bg-gray-400 text-white' };
  return (
    <span className={`inline-block text-xs font-bold px-2 py-0.5 rounded uppercase tracking-wide ${cls}`}>
      {label}
    </span>
  );
}
