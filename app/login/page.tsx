'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleDigit = (d: string) => {
    if (pin.length < 4) setPin((p) => p + d);
  };
  const handleBackspace = () => setPin((p) => p.slice(0, -1));

  const submit = async () => {
    if (!phone || pin.length !== 4) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, pin }),
      });
      const json = await res.json();
      if (!json.ok) { setError(json.error ?? 'Login failed'); return; }
      router.push('/queue');
    } finally {
      setLoading(false);
    }
  };

  const digits = ['1','2','3','4','5','6','7','8','9','','0','⌫'];

  return (
    <div className="min-h-screen bg-charcoal flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-amber text-3xl font-bold text-center mb-1">TruckFlow</h1>
        <p className="text-paper/50 text-sm text-center mb-8">Brewery Gate Management</p>

        <div className="bg-paper rounded-2xl p-6 shadow-2xl">
          <label className="block text-sm font-semibold text-charcoal mb-1">Phone Number</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="08010000001"
            className="w-full border-2 border-charcoal/20 rounded-lg px-4 py-3 text-lg font-mono focus:border-amber focus:outline-none mb-4"
          />

          <label className="block text-sm font-semibold text-charcoal mb-2">PIN</label>
          <div className="flex gap-3 justify-center mb-6">
            {[0,1,2,3].map((i) => (
              <div key={i} className={`w-12 h-12 rounded-lg border-2 flex items-center justify-center text-2xl font-bold transition-colors ${pin.length > i ? 'bg-charcoal border-charcoal text-paper' : 'border-charcoal/20'}`}>
                {pin.length > i ? '●' : ''}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-3 mb-4">
            {digits.map((d, i) => (
              <button
                key={i}
                onClick={() => d === '⌫' ? handleBackspace() : d ? handleDigit(d) : undefined}
                disabled={!d}
                className={`h-14 rounded-xl text-xl font-bold transition-all active:scale-95 ${d === '⌫' ? 'bg-charcoal/10 text-charcoal' : d ? 'bg-charcoal text-paper hover:bg-charcoal/80' : 'invisible'}`}
              >
                {d}
              </button>
            ))}
          </div>

          {error && <p className="text-red-alert text-sm text-center mb-3 font-medium">{error}</p>}

          <button
            onClick={submit}
            disabled={loading || !phone || pin.length !== 4}
            className="w-full bg-amber text-charcoal font-bold py-4 rounded-xl text-lg disabled:opacity-40 active:scale-95 transition-all"
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </div>
      </div>
    </div>
  );
}
