'use client';
import { useState } from 'react';
import { Check, RotateCcw } from 'lucide-react';
import { Button, ErrorNote } from './ui';
import { useTargets } from '@/hooks/useTargets';
import { DEFAULT_TARGETS, TARGET_GROUPS, TARGET_KEYS, type Targets } from '@/lib/targets';
import { fmtMinutes } from '@/lib/client-types';

type Draft = Record<string, { target: string; limit: string }>;

const toDraft = (t: Targets): Draft =>
  Object.fromEntries(TARGET_KEYS.map((k) => [k, { target: String(t[k].target), limit: String(t[k].limit) }]));

function problem(d: { target: string; limit: string }): string | null {
  const t = Number(d.target);
  const l = Number(d.limit);
  if (!Number.isInteger(t) || !Number.isInteger(l) || t < 1 || l < 1) return 'Whole minutes, 1 or more';
  if (t > 1440 || l > 1440) return 'At most 24h (1440 min)';
  if (l <= t) return 'Limit must be longer than target';
  return null;
}

const numCls =
  'w-full min-h-12 rounded-xl border-2 bg-surface px-3 text-lg font-mono text-right focus:outline-none focus:border-amber-ink';

/**
 * Admin-editable plant time targets. "Target" is where a step starts running
 * long (amber); "limit" is overdue (red) and triggers a supervisor alert.
 */
export default function TargetsEditor() {
  const { targets, refresh } = useTargets();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const current = draft ?? toDraft(targets);
  const saved_ = toDraft(targets);
  const changed = TARGET_KEYS.filter((k) => current[k].target !== saved_[k].target || current[k].limit !== saved_[k].limit);
  const invalid = TARGET_KEYS.filter((k) => problem(current[k]));

  const set = (key: string, field: 'target' | 'limit', value: string) => {
    setSaved(false);
    setDraft({ ...current, [key]: { ...current[key], [field]: value.replace(/\D/g, '').slice(0, 4) } });
  };

  const save = async () => {
    setSaving(true);
    setError('');
    const body = Object.fromEntries(
      TARGET_KEYS.map((k) => [k, { target: Number(current[k].target), limit: Number(current[k].limit) }])
    );
    const r = await fetch('/api/admin/targets', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
      .then((x) => x.json())
      .catch(() => null);
    setSaving(false);
    if (!r?.ok) {
      setError(r?.error ?? 'Could not save. Check your connection.');
      return;
    }
    await refresh(r.data, { revalidate: false });
    setDraft(null);
    setSaved(true);
  };

  return (
    <div>
      <p className="text-ink-2 mb-5">
        <span className="font-semibold text-charcoal">Target</span> is when a truck starts showing amber.{' '}
        <span className="font-semibold text-charcoal">Limit</span> turns it red and alerts supervisors and distribution
        leads. Changes apply to every screen within seconds.
      </p>

      <div className="space-y-6">
        {TARGET_GROUPS.map((g) => (
          <section key={g.title} aria-labelledby={`tg-${g.title}`} className="bg-surface rounded-2xl shadow-card p-5">
            <h2 id={`tg-${g.title}`} className="text-lg font-semibold">{g.title}</h2>
            <p className="text-sm text-ink-2 mb-3">{g.hint}, in minutes</p>

            <div className="grid grid-cols-[minmax(0,1fr)_5.5rem_5.5rem] gap-x-3 text-xs font-semibold text-ink-2 pb-1">
              <span />
              <span className="text-right pr-1">Target</span>
              <span className="text-right pr-1">Limit</span>
            </div>
            <ul className="divide-y divide-line">
              {g.items.map(({ key, label }) => {
                const d = current[key];
                const err = problem(d);
                const isChanged = changed.includes(key);
                const def = DEFAULT_TARGETS[key];
                return (
                  <li key={key} className="py-2.5">
                    <div className="grid grid-cols-[minmax(0,1fr)_5.5rem_5.5rem] gap-x-3 items-center">
                      <div className="min-w-0">
                        <p className="font-semibold truncate">
                          {label}
                          {isChanged && <span className="ml-2 align-middle size-2 inline-block rounded-full bg-amber" aria-label="changed" />}
                        </p>
                        <p className="text-xs text-ink-2 tnum">
                          {!err ? `${fmtMinutes(Number(d.target))} / ${fmtMinutes(Number(d.limit))}` : ' '}
                        </p>
                      </div>
                      <input
                        aria-label={`${label} target, minutes`}
                        inputMode="numeric"
                        value={d.target}
                        onChange={(e) => set(key, 'target', e.target.value)}
                        className={`${numCls} ${err ? 'border-danger' : 'border-line'}`}
                        placeholder={String(def.target)}
                      />
                      <input
                        aria-label={`${label} limit, minutes`}
                        inputMode="numeric"
                        value={d.limit}
                        onChange={(e) => set(key, 'limit', e.target.value)}
                        className={`${numCls} ${err ? 'border-danger' : 'border-line'}`}
                        placeholder={String(def.limit)}
                      />
                    </div>
                    {err && <p role="alert" className="mt-1 text-sm text-danger font-medium">{err}</p>}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      <button
        onClick={() => {
          setSaved(false);
          setDraft(toDraft(DEFAULT_TARGETS));
        }}
        className="mt-4 inline-flex items-center gap-1.5 min-h-11 text-sm font-semibold text-ink-2 hover:text-charcoal"
      >
        <RotateCcw className="size-4" aria-hidden /> Reset all to defaults
      </button>

      {/* Save bar: sits above the phone tab bar, only when there's something to save. */}
      {(changed.length > 0 || error) && (
        <div className="sticky bottom-20 md:bottom-4 z-30 mt-4">
          <div className="anim-toast rounded-2xl bg-charcoal text-paper p-3 pl-4 shadow-raised flex items-center gap-3">
            <p className="flex-1 text-sm">
              {invalid.length > 0
                ? `Fix ${invalid.length} ${invalid.length === 1 ? 'row' : 'rows'} before saving`
                : `${changed.length} unsaved ${changed.length === 1 ? 'change' : 'changes'}`}
            </p>
            <Button size="md" variant="ghost" className="text-paper hover:bg-white/10" onClick={() => { setDraft(null); setError(''); }}>
              Discard
            </Button>
            <Button size="md" loading={saving} disabled={invalid.length > 0} onClick={save}>
              Save targets
            </Button>
          </div>
          <div className="mt-2"><ErrorNote>{error}</ErrorNote></div>
        </div>
      )}

      {saved && changed.length === 0 && (
        <p role="status" className="mt-4 inline-flex items-center gap-2 text-ok font-semibold">
          <Check className="size-5" aria-hidden /> Targets saved
        </p>
      )}
    </div>
  );
}
