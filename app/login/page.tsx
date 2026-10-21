'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Delete, Loader2 } from 'lucide-react';
import { homeFor, ROLE_LABELS } from '@/lib/access';

const PHONE_KEY = 'tf:lastPhone';
const DEMO = process.env.NEXT_PUBLIC_DEMO_MODE === '1';
const DEMO_USERS = [
  ['08010000001', 'GATE_OFFICER'],
  ['08010000002', 'FORKLIFT_OPERATOR'],
  ['08010000003', 'FUELING_STAFF'],
  ['08010000004', 'SUPERVISOR'],
  ['08010000006', 'ADMIN'],
] as const;

export default function LoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const busy = useRef(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(PHONE_KEY);
      // Restore after hydration so server and client markup match.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved) setPhone(saved);
    } catch { /* storage unavailable */ }
  }, []);

  const submit = useCallback(async (p: string, code: string) => {
    if (busy.current || !p || code.length !== 4) return;
    busy.current = true;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: p.trim(), pin: code }),
      });
      const json = await res.json();
      if (!json.ok) {
        setError(json.error === 'Invalid credentials' ? 'That phone number and PIN don’t match. Try again.' : json.error);
        setPin('');
        return;
      }
      try { localStorage.setItem(PHONE_KEY, p.trim()); } catch { /* ignore */ }
      router.push(homeFor(json.data.role));
    } catch {
      setError('Can’t reach the server. Check your connection.');
      setPin('');
    } finally {
      busy.current = false;
      setLoading(false);
    }
  }, [router]);

  const press = useCallback((d: string) => {
    setError('');
    setPin((prev) => {
      if (prev.length >= 4) return prev;
      const next = prev + d;
      // Sign in the moment the fourth digit lands; no extra button press.
      if (next.length === 4) setTimeout(() => submit(phone, next), 120);
      return next;
    });
  }, [phone, submit]);

  const back = () => setPin((p) => p.slice(0, -1));

  // Hardware keyboard support for desktop/tablet use.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === 'Backspace') back();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [press]);

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];

  return (
    <div className="min-h-screen bg-charcoal flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-amber-light text-4xl font-bold tracking-tight">TruckFlow</h1>
          <p className="text-on-dark-2 mt-1">Brewery gate and plant</p>
        </div>

        <div className="bg-paper rounded-3xl p-6 shadow-raised">
          <label htmlFor="phone" className="block text-sm font-semibold mb-1.5">Phone number</label>
          <input
            id="phone"
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="080 1000 0001"
            className="w-full min-h-14 rounded-xl border-2 border-line bg-surface px-4 text-xl font-mono tracking-wide placeholder:text-ink-2/70 focus:border-amber-ink focus:outline-none"
          />

          <p id="pin-label" className="text-sm font-semibold mt-5 mb-2">PIN</p>
          <div className="flex gap-3 justify-center mb-5" role="status" aria-labelledby="pin-label" aria-live="polite">
            {[0, 1, 2, 3].map((i) => (
              <span
                key={i}
                className={`size-4 rounded-full border-2 transition-colors duration-150 ${
                  pin.length > i ? 'bg-charcoal border-charcoal' : 'border-line-strong'
                }`}
              />
            ))}
            <span className="sr-only">{pin.length} of 4 digits entered</span>
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            {keys.map((k, i) =>
              k === '' ? (
                <span key={i} />
              ) : (
                <button
                  key={i}
                  type="button"
                  onClick={() => (k === 'del' ? back() : press(k))}
                  disabled={loading || !phone.trim()}
                  aria-label={k === 'del' ? 'Delete last digit' : k}
                  className={`h-16 rounded-2xl text-2xl font-semibold transition-[transform,background-color] duration-100 active:scale-95 disabled:opacity-40 ${
                    k === 'del' ? 'bg-transparent text-charcoal hover:bg-charcoal/5 grid place-items-center' : 'bg-surface shadow-card hover:bg-white'
                  }`}
                >
                  {k === 'del' ? <Delete className="size-6" aria-hidden /> : k}
                </button>
              )
            )}
          </div>

          <div className="min-h-12 mt-4 flex items-center justify-center text-center">
            {loading ? (
              <span className="inline-flex items-center gap-2 text-ink-2 font-medium">
                <Loader2 className="size-5 animate-spin" aria-hidden /> Signing in…
              </span>
            ) : error ? (
              <p role="alert" className="text-danger text-sm font-medium">{error}</p>
            ) : !phone.trim() ? (
              <p className="text-ink-2 text-sm">Enter your phone number, then your PIN</p>
            ) : null}
          </div>
        </div>

        {DEMO && (
          <details className="mt-6 text-paper">
            <summary className="cursor-pointer text-center text-sm text-on-dark-2 hover:text-paper min-h-11 flex items-center justify-center">
              Demo accounts (PIN 1234)
            </summary>
            <ul className="mt-2 grid grid-cols-2 gap-2">
              {DEMO_USERS.map(([p, role]) => (
                <li key={p}>
                  <button
                    type="button"
                    onClick={() => { setPhone(p); setPin(''); setError(''); }}
                    className="w-full text-left rounded-xl bg-white/5 hover:bg-white/10 px-3 py-2.5"
                  >
                    <span className="block text-sm font-semibold">{ROLE_LABELS[role]}</span>
                    <span className="block text-xs font-mono text-on-dark-2">{p}</span>
                  </button>
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </div>
  );
}
