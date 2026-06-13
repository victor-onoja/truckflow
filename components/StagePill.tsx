import { THRESHOLDS_MIN } from '@/lib/stages';

type Props = {
  stageKey: string;
  stageName: string;
  elapsedMinutes: number | null;
};

export default function StagePill({ stageKey, stageName, elapsedMinutes }: Props) {
  const threshold = THRESHOLDS_MIN[stageKey];
  let colorCls = 'bg-green-100 text-green-800 border-green-300';
  if (threshold && elapsedMinutes !== null) {
    if (elapsedMinutes >= threshold.red) colorCls = 'bg-red-100 text-red-800 border-red-400';
    else if (elapsedMinutes >= threshold.amber) colorCls = 'bg-amber-100 text-amber-800 border-amber-400';
  }

  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border ${colorCls}`}>
      {stageName}
      {elapsedMinutes !== null && <span className="font-mono">{elapsedMinutes}m</span>}
    </span>
  );
}
