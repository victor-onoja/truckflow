'use client';
import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, LogOut, NotebookPen, Play, Square, Undo2, Hourglass } from 'lucide-react';
import { Button, ErrorNote } from './ui';
import { ROLE_LABELS } from '@/lib/access';
import { canDo, type VisitSummary } from '@/lib/client-types';

const TOAST_MS = 10_000;
const CONFIRM_MS = 4_000;

export type Toast = { id: number; visitId: string; message: string; undoable: boolean };

/**
 * The one thing this user can do for this truck right now. The server decides
 * what that is; this component just shows it as a single big button.
 */
export default function ActionPanel({
  visit,
  role,
  onChanged,
  onVisitGone,
  compact = false,
}: {
  visit: VisitSummary;
  role: string;
  onChanged: () => void;
  onVisitGone?: () => void;
  /** Queue rows: smaller button, no note field, nothing shown when it isn't your step. */
  compact?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  // Error and gate-out arming belong to the step they were raised on; when the
  // server moves the visit on, they no longer apply and simply stop showing.
  const [errorFor, setErrorFor] = useState<{ step: string; msg: string } | null>(null);
  const [armedFor, setArmedFor] = useState<string | null>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState('');
  const [toast, setToast] = useState<Toast | null>(null);
  const armTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const next = visit.next;
  const mine = canDo(next, role);
  const stepId = `${visit.id}:${next.kind}:${'stageKey' in next ? next.stageKey : ''}`;
  const armed = armedFor === stepId;
  const error = errorFor?.step === stepId ? errorFor.msg : '';
  const setError = (msg: string) => setErrorFor(msg ? { step: stepId, msg } : null);

  useEffect(() => () => clearTimeout(armTimer.current), []);

  const run = async () => {
    // Gate out notifies distribution and can't be undone, so it takes a second tap.
    if (next.kind === 'GATE_OUT' && !armed) {
      setArmedFor(stepId);
      clearTimeout(armTimer.current);
      armTimer.current = setTimeout(() => setArmedFor(null), CONFIRM_MS);
      return;
    }
    setBusy(true);
    setError('');
    try {
      const r = await fetch(`/api/visits/${visit.id}/advance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expect: { kind: next.kind, stageKey: 'stageKey' in next ? next.stageKey : undefined },
          notes: note || undefined,
        }),
      });
      const j = await r.json();
      if (!j.ok) {
        setError(j.error ?? 'Something went wrong. Try again.');
        onChanged();
        return;
      }
      setNote('');
      setNoteOpen(false);
      setArmedFor(null);
      setToast({ id: Date.now(), visitId: visit.id, message: `${visit.truckPlate}: ${j.data.did}`, undoable: next.kind !== 'GATE_OUT' });
      onChanged();
    } catch {
      setError('No connection. Check signal and tap again.');
    } finally {
      setBusy(false);
    }
  };

  if (next.kind === 'DONE') {
    return toast ? <UndoToast key={toast.id} toast={toast} onClose={() => setToast(null)} onUndone={onChanged} /> : null;
  }

  if (!mine) {
    if (compact) return toast ? <UndoToast key={toast.id} toast={toast} onClose={() => setToast(null)} onUndone={onChanged} /> : null;
    const who = next.roles.filter((r) => r !== 'ADMIN').map((r) => ROLE_LABELS[r]?.toLowerCase()).join(' or ');
    return (
      <>
        <div className="flex items-start gap-3 rounded-2xl border border-line bg-surface px-4 py-3.5">
          <Hourglass className="size-5 mt-0.5 shrink-0 text-ink-2" aria-hidden />
          <p className="text-sm text-ink-2">
            Next: <span className="font-semibold text-charcoal">{next.label.toLowerCase()}</span>
            {who && <> by {who}</>}
          </p>
        </div>
        {toast && <UndoToast key={toast.id} toast={toast} onClose={() => setToast(null)} onUndone={onChanged} onVisitGone={onVisitGone} />}
      </>
    );
  }

  const icon =
    next.kind === 'GATE_OUT' ? <LogOut className="size-6" aria-hidden /> :
    next.kind === 'START' ? <Play className="size-6" aria-hidden /> :
    next.chainsTo ? <ArrowRight className="size-6" aria-hidden /> :
    <Square className="size-5" aria-hidden />;

  return (
    <div className="space-y-2">
      <Button
        size={compact ? 'lg' : 'xl'}
        variant={next.kind === 'GATE_OUT' ? (armed ? 'danger' : 'dark') : 'primary'}
        className="w-full text-left"
        loading={busy}
        icon={icon}
        onClick={run}
      >
        <span className="flex-1">
          {armed ? `Tap again to gate out ${visit.truckPlate}` : next.label}
        </span>
      </Button>

      {!compact && next.kind !== 'GATE_OUT' && (
        noteOpen ? (
          <label className="block">
            <span className="sr-only">Note for this step</span>
            <input
              autoFocus
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
              placeholder="Note, e.g. broken crate on pallet 3"
              className="w-full min-h-12 rounded-xl border-2 border-line bg-surface px-4 text-base focus:border-amber-ink focus:outline-none"
            />
          </label>
        ) : (
          <button
            onClick={() => setNoteOpen(true)}
            className="inline-flex items-center gap-1.5 min-h-11 px-1 text-sm font-medium text-ink-2 hover:text-charcoal"
          >
            <NotebookPen className="size-4" aria-hidden /> Add a note
          </button>
        )
      )}

      <ErrorNote>{error}</ErrorNote>
      {toast && <UndoToast key={toast.id} toast={toast} onClose={() => setToast(null)} onUndone={onChanged} onVisitGone={onVisitGone} />}
    </div>
  );
}

export function UndoToast({
  toast,
  onClose,
  onUndone,
  onVisitGone,
}: {
  toast: Toast;
  onClose: () => void;
  onUndone: () => void;
  onVisitGone?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  // Parents render this with key={toast.id}, so each new toast starts fresh.
  const [msg, setMsg] = useState(toast.message);
  const [canUndo, setCanUndo] = useState(toast.undoable);
  const closeRef = useRef(onClose);

  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const t = setTimeout(() => closeRef.current(), TOAST_MS);
    return () => clearTimeout(t);
  }, []);

  const undo = async () => {
    setBusy(true);
    const r = await fetch(`/api/visits/${toast.visitId}/undo`, { method: 'POST' }).then((x) => x.json()).catch(() => null);
    setBusy(false);
    setCanUndo(false);
    if (!r?.ok) {
      setMsg(r?.error ?? 'Could not undo');
      return;
    }
    setMsg(r.data.undid);
    if (r.data.visitDeleted) onVisitGone?.();
    else onUndone();
  };

  return (
    <div className="fixed inset-x-0 bottom-20 md:bottom-6 z-50 px-4 pointer-events-none">
      <div
        role="status"
        className="anim-toast pointer-events-auto mx-auto max-w-md flex items-center gap-3 rounded-2xl bg-charcoal text-paper pl-4 pr-2 py-2 shadow-raised"
      >
        <Check className="size-5 shrink-0 text-amber-light" aria-hidden />
        <p className="flex-1 text-sm font-medium py-2">{msg}</p>
        {canUndo && (
          <button
            onClick={undo}
            disabled={busy}
            className="inline-flex items-center gap-1.5 min-h-11 px-3 rounded-xl font-semibold text-amber-light hover:bg-white/10 disabled:opacity-50"
          >
            <Undo2 className="size-4" aria-hidden /> Undo
          </button>
        )}
      </div>
    </div>
  );
}
