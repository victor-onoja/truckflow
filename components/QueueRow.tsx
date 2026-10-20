'use client';
import Link from 'next/link';
import { AlertTriangle, ChevronRight } from 'lucide-react';
import VisitTypeBadge from './VisitTypeBadge';
import StagePill from './StagePill';
import ActionPanel from './ActionPanel';
import { fmtMinutes, fmtTime, type QueueEntry } from '@/lib/client-types';

export default function QueueRow({
  entry,
  role,
  showAction,
  onChanged,
}: {
  entry: QueueEntry;
  role: string;
  showAction: boolean;
  onChanged: () => void;
}) {
  return (
    <li className={`bg-surface rounded-2xl shadow-card overflow-hidden ${entry.health === 'over' ? 'ring-1 ring-danger/50' : ''}`}>
      <Link href={`/visit/${entry.id}`} className="flex items-start gap-3 p-4 hover:bg-charcoal/[0.02]">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-mono font-semibold text-xl tracking-wide">{entry.truckPlate}</span>
            <VisitTypeBadge type={entry.visitType} />
          </div>
          <p className="text-sm text-ink-2 truncate mt-0.5">{entry.driverName}</p>
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
            <StagePill
              label={entry.statusLabel}
              minutes={entry.minutesInStep}
              health={entry.health}
              ready={entry.next.kind === 'GATE_OUT'}
            />
            <span
              className={`inline-flex items-center gap-1 text-xs tnum ${
                entry.tct?.health === 'over' ? 'text-danger font-semibold' : entry.tct?.health === 'warn' ? 'text-amber-ink font-semibold' : 'text-ink-2'
              }`}
            >
              {entry.tct && entry.tct.health !== 'ok' && <AlertTriangle className="size-3" aria-label="over TCT target" />}
              In {fmtTime(entry.gateInAt)} · in plant {fmtMinutes(entry.totalElapsed)}
            </span>
          </div>
        </div>
        <ChevronRight className="size-5 text-ink-2 mt-1 shrink-0" aria-hidden />
      </Link>
      {showAction && (
        <div className="px-4 pb-4 -mt-1">
          <ActionPanel visit={entry} role={role} onChanged={onChanged} compact />
        </div>
      )}
    </li>
  );
}
