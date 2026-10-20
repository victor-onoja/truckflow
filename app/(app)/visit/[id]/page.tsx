'use client';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import useSWR from 'swr';
import { AlertTriangle, Check, ChevronLeft, CircleCheck, Loader2 } from 'lucide-react';
import ActionPanel from '@/components/ActionPanel';
import VisitTypeBadge from '@/components/VisitTypeBadge';
import StagePill from '@/components/StagePill';
import { useMe } from '@/hooks/useMe';
import { useTargets } from '@/hooks/useTargets';
import type { Targets } from '@/lib/targets';
import { fmtMinutes, fmtTime, type VisitSummary } from '@/lib/client-types';

type StageEntry = {
  key: string;
  name: string;
  num: number;
  capture: 'INSTANT' | 'DERIVED' | 'START_END';
  event: { startAt: string; endAt: string | null; durationMinutes: number | null; notes: string | null; by: string } | null;
};

type VisitDetail = VisitSummary & { gateOutAt: string | null; sequence: StageEntry[] };

const fetcher = (url: string) =>
  fetch(url).then((r) => r.json()).then((j) => {
    if (!j.ok) throw new Error(j.error);
    return j.data;
  });

function Marker({ state, num }: { state: 'done' | 'now' | 'todo'; num: number }) {
  if (state === 'done')
    return (
      <span className="grid place-items-center size-8 rounded-full bg-ok text-white shrink-0">
        <Check className="size-4" strokeWidth={3} aria-hidden />
      </span>
    );
  if (state === 'now')
    return (
      <span className="relative grid place-items-center size-8 rounded-full bg-amber text-charcoal font-semibold text-sm shrink-0">
        <span className="absolute inset-0 rounded-full ring-4 ring-amber/30 motion-safe:animate-pulse" aria-hidden />
        {num}
      </span>
    );
  return (
    <span className="grid place-items-center size-8 rounded-full border-2 border-line-strong text-ink-2 font-semibold text-sm shrink-0">
      {num}
    </span>
  );
}

function RanLong({ stageKey, minutes, targets }: { stageKey: string; minutes: number | null; targets: Targets }) {
  const t = targets[stageKey];
  if (!t || minutes == null || minutes < t.target) return null;
  const over = minutes >= t.limit;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold ${over ? 'text-danger' : 'text-amber-ink'}`}>
      <AlertTriangle className="size-3.5" aria-hidden />
      {over ? `over ${fmtMinutes(t.limit)} limit` : `over ${fmtMinutes(t.target)} target`}
    </span>
  );
}

function TctNote({ visit, active }: { visit: VisitDetail; active: boolean }) {
  const h = visit.tct?.health ?? 'ok';
  const tone = h === 'over' ? 'text-danger font-semibold' : h === 'warn' ? 'text-amber-ink font-semibold' : 'text-ink-2';
  return (
    <span className={`inline-flex items-center gap-1 text-sm tnum ${tone}`}>
      {h !== 'ok' && <AlertTriangle className="size-3.5" aria-hidden />}
      {active ? `In plant ${fmtMinutes(visit.totalElapsed)}` : `${fmtTime(visit.gateInAt)}–${fmtTime(visit.gateOutAt)} · TCT ${fmtMinutes(visit.totalElapsed)}`}
      {visit.tct && <span className="font-normal text-ink-2"> / {fmtMinutes(visit.tct.target)} target</span>}
    </span>
  );
}

export default function VisitPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const me = useMe();
  const { targets } = useTargets();
  const { data: visit, error, isLoading, mutate } = useSWR<VisitDetail>(`/api/visits/${id}`, fetcher, {
    refreshInterval: 10000,
  });

  if (isLoading)
    return (
      <div className="py-16 grid place-items-center text-ink-2">
        <Loader2 className="size-6 animate-spin" aria-label="Loading visit" />
      </div>
    );
  if (error || !visit)
    return (
      <div className="max-w-xl mx-auto py-16 text-center">
        <p className="font-semibold text-lg">This visit doesn’t exist</p>
        <p className="text-ink-2 mt-1">It may have been cancelled at the gate.</p>
        <Link href="/queue" className="mt-4 inline-flex min-h-11 items-center font-semibold text-amber-ink hover:underline">
          Back to the queue
        </Link>
      </div>
    );

  const active = visit.status === 'ACTIVE';
  // The first not-yet-finished START_END stage is "now" (in progress or next up).
  const nowKey = visit.next.kind === 'START' || visit.next.kind === 'END' ? visit.next.stageKey : null;
  const firstStarted = visit.sequence.find((s) => s.capture === 'START_END' && s.event);

  return (
    <div className="max-w-xl mx-auto">
      <Link href="/queue" className="inline-flex items-center gap-1 min-h-11 -ml-1 text-sm font-medium text-ink-2 hover:text-charcoal">
        <ChevronLeft className="size-4" aria-hidden /> Queue
      </Link>

      <header className="mt-1 mb-5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h1 className="font-mono font-semibold text-3xl tracking-wide">{visit.truckPlate}</h1>
          <VisitTypeBadge type={visit.visitType} />
        </div>
        <p className="text-ink-2 mt-0.5">{visit.driverName}</p>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
          <StagePill
            label={visit.statusLabel}
            minutes={visit.minutesInStep}
            health={visit.health}
            ready={visit.next.kind === 'GATE_OUT'}
            done={!active}
          />
          <TctNote visit={visit} active={active} />
        </div>
      </header>

      {active && me && (
        <div className="mb-6">
          <ActionPanel visit={visit} role={me.role} onChanged={() => mutate()} onVisitGone={() => router.push('/queue')} />
        </div>
      )}

      {!active && (
        <div className="mb-6 flex items-center gap-3 rounded-2xl bg-ok-wash text-ok px-4 py-3.5">
          <CircleCheck className="size-5 shrink-0" aria-hidden />
          <p className="font-semibold">Gated out at {fmtTime(visit.gateOutAt)} after {fmtMinutes(visit.totalElapsed)}</p>
        </div>
      )}

      <section aria-labelledby="timeline-h" className="bg-surface rounded-2xl shadow-card px-4 py-2">
        <h2 id="timeline-h" className="sr-only">Timeline</h2>
        <ol>
          {visit.sequence.map((s, i) => {
            const last = i === visit.sequence.length - 1;
            let state: 'done' | 'now' | 'todo' = 'todo';
            let detail: React.ReactNode = null;

            if (s.capture === 'INSTANT') {
              state = s.event ? 'done' : visit.next.kind === 'GATE_OUT' && s.key === 'GATE_OUT' ? 'now' : 'todo';
              detail = s.event ? <>{fmtTime(s.event.startAt)} · {s.event.by}</> : s.key === 'GATE_OUT' && state === 'now' ? 'Ready to leave' : null;
            } else if (s.capture === 'DERIVED') {
              const waited = visit.queuingMinutes;
              state = waited != null ? 'done' : active ? 'now' : 'todo';
              detail =
                waited != null ? (
                  <span className="inline-flex flex-wrap gap-x-2">
                    Waited {fmtMinutes(waited)} <RanLong stageKey="QUEUING" minutes={waited} targets={targets} />
                  </span>
                ) : active && !firstStarted ? (
                  'Waiting now'
                ) : null;
            } else if (s.event) {
              state = s.event.endAt ? 'done' : 'now';
              detail = (
                <span className="inline-flex flex-wrap gap-x-2">
                  <span className="tnum">
                    {fmtTime(s.event.startAt)}–{s.event.endAt ? fmtTime(s.event.endAt) : 'now'}
                    {s.event.durationMinutes != null && ` · ${fmtMinutes(s.event.durationMinutes)}`}
                  </span>
                  <RanLong stageKey={s.key} minutes={s.event.durationMinutes} targets={targets} />
                </span>
              );
            } else if (s.key === nowKey) {
              state = 'now';
              detail = 'Up next';
            }

            return (
              <li key={s.key} className="relative flex gap-3 py-3">
                {!last && (
                  <span
                    className={`absolute left-[15px] top-12 bottom-0 w-0.5 ${state === 'done' ? 'bg-ok/40' : 'bg-line'}`}
                    aria-hidden
                  />
                )}
                <Marker state={state} num={s.num} />
                <div className="flex-1 min-w-0 pt-1">
                  <p className={`font-semibold ${state === 'todo' ? 'text-ink-2' : ''}`}>
                    {s.name}
                    <span className="sr-only"> ({state === 'done' ? 'done' : state === 'now' ? 'current' : 'not started'})</span>
                  </p>
                  {detail && <p className="text-sm text-ink-2 mt-0.5">{detail}</p>}
                  {s.capture === 'START_END' && s.event?.endAt && (
                    <p className="text-xs text-ink-2 mt-0.5">by {s.event.by}</p>
                  )}
                  {s.event?.notes && (
                    <p className="mt-1.5 text-sm bg-paper rounded-lg px-3 py-2">“{s.event.notes}”</p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
