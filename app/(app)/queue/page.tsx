'use client';
import Link from 'next/link';
import { useLiveQueue } from '@/hooks/useLiveQueue';
import VisitTypeBadge from '@/components/VisitTypeBadge';
import StagePill from '@/components/StagePill';
import { THRESHOLDS_MIN } from '@/lib/stages';

function elapsed(ms: number): string {
  const h = Math.floor(ms / 60);
  const m = ms % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function statusColor(stageKey: string, minutes: number | null): string {
  if (minutes === null) return 'border-l-4 border-green-ok';
  const t = THRESHOLDS_MIN[stageKey];
  if (!t) return 'border-l-4 border-green-ok';
  if (minutes >= t.red) return 'border-l-4 border-red-alert';
  if (minutes >= t.amber) return 'border-l-4 border-amber';
  return 'border-l-4 border-green-ok';
}

export default function QueuePage() {
  const { queue, isLoading } = useLiveQueue();

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">Live Queue</h2>
        <span className="text-sm text-charcoal/50 font-mono">{queue.length} active</span>
      </div>

      {isLoading && (
        <div className="space-y-3">
          {[1,2,3].map((i) => (
            <div key={i} className="h-24 bg-charcoal/5 rounded-xl animate-pulse" />
          ))}
        </div>
      )}

      {!isLoading && queue.length === 0 && (
        <div className="text-center py-16 text-charcoal/40">
          <div className="text-5xl mb-3">🚛</div>
          <p className="font-semibold text-lg">No trucks on site</p>
          <p className="text-sm">Gate in a truck to get started</p>
        </div>
      )}

      <div className="space-y-3">
        {queue.map((entry) => (
          <Link
            key={entry.id}
            href={`/visit/${entry.id}`}
            className={`block bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow ${statusColor(entry.currentStage, entry.elapsedInStage)}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono font-bold text-lg tracking-wide">{entry.truckPlate}</span>
                  <VisitTypeBadge type={entry.visitType} />
                </div>
                <p className="text-sm text-charcoal/60 truncate">{entry.driverName}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <StagePill
                  stageKey={entry.currentStage}
                  stageName={entry.currentStageName}
                  elapsedMinutes={entry.elapsedInStage}
                />
                <p className="text-xs text-charcoal/40 mt-1 font-mono">Total: {elapsed(entry.totalElapsed)}</p>
              </div>
            </div>

            <div className="mt-2 flex gap-4 text-xs text-charcoal/50 font-mono">
              <span>#{entry.queuePosition}</span>
              {entry.queuingMinutes !== null && <span>Queued: {entry.queuingMinutes}m</span>}
              <span>In: {new Date(entry.gateInAt).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
