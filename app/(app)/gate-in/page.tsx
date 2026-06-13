'use client';
import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';

const QrScanner = dynamic(() => import('@/components/QrScanner'), { ssr: false });

type VisitType = 'FULL_CYCLE' | 'OFFLOAD_ONLY' | 'LOAD_ONLY';
const VISIT_TYPES: { value: VisitType; label: string; desc: string; color: string }[] = [
  { value: 'FULL_CYCLE',   label: 'Full Cycle',   desc: 'Offload empties + load product', color: 'border-amber bg-amber/10' },
  { value: 'OFFLOAD_ONLY', label: 'Offload Only', desc: 'Return empties only',             color: 'border-blue-600 bg-blue-50' },
  { value: 'LOAD_ONLY',    label: 'Load Only',    desc: 'Pick up product only',            color: 'border-green-600 bg-green-50' },
];

export default function GateInPage() {
  const router = useRouter();
  const [tab, setTab] = useState<'scan' | 'manual'>('scan');
  const [visitType, setVisitType] = useState<VisitType>('FULL_CYCLE');
  const [manualCode, setManualCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<{ plate: string; driver: string; visitId: string } | null>(null);

  const submit = async (code: string) => {
    setLoading(true);
    setError('');
    try {
      const body: Record<string, string> = { visitType };
      if (tab === 'scan' || code.startsWith('TF-')) {
        body.qrCode = code;
      } else {
        body.manualCode = code;
      }

      const res = await fetch('/api/gate-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!json.ok) { setError(json.error ?? 'Gate in failed'); return; }
      setSuccess({ plate: json.data.truck.plateNumber, driver: json.data.truck.driverName, visitId: json.data.id });
    } finally {
      setLoading(false);
    }
  };

  const handleScan = (code: string) => {
    if (!loading) submit(code);
  };

  if (success) {
    return (
      <div className="text-center">
        <div className="bg-green-ok/10 border-2 border-green-ok rounded-2xl p-8 mb-6">
          <div className="text-5xl mb-3">✅</div>
          <h2 className="text-2xl font-bold text-green-800 mb-1">Gate In Successful</h2>
          <p className="font-mono text-xl font-bold">{success.plate}</p>
          <p className="text-charcoal/60">{success.driver}</p>
          <p className="mt-2 text-sm text-charcoal/50">Visit type: {visitType.replace('_', ' ')}</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => router.push('/queue')}
            className="flex-1 bg-charcoal text-paper py-4 rounded-xl font-bold text-lg"
          >
            View Queue
          </button>
          <button
            onClick={() => { setSuccess(null); setManualCode(''); }}
            className="flex-1 border-2 border-charcoal py-4 rounded-xl font-bold text-lg"
          >
            Gate In Another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Gate In</h2>

      {/* Visit type selector */}
      <div className="space-y-2 mb-6">
        <label className="text-sm font-semibold">Visit Type</label>
        {VISIT_TYPES.map((vt) => (
          <button
            key={vt.value}
            onClick={() => setVisitType(vt.value)}
            className={`w-full text-left p-4 rounded-xl border-2 transition-all ${visitType === vt.value ? vt.color : 'border-charcoal/20 bg-white'}`}
          >
            <div className="font-bold">{vt.label}</div>
            <div className="text-sm text-charcoal/60">{vt.desc}</div>
          </button>
        ))}
      </div>

      {/* Tab switcher */}
      <div className="flex rounded-xl bg-charcoal/10 p-1 mb-4">
        {(['scan', 'manual'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-lg font-semibold text-sm transition-all ${tab === t ? 'bg-charcoal text-paper shadow' : 'text-charcoal/60'}`}
          >
            {t === 'scan' ? '📷 Scan QR' : '⌨️ Enter Code'}
          </button>
        ))}
      </div>

      {tab === 'scan' && (
        <div className="rounded-xl overflow-hidden border-2 border-charcoal/20 bg-black aspect-square">
          <QrScanner onScan={handleScan} />
        </div>
      )}

      {tab === 'manual' && (
        <div>
          <input
            type="text"
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value.toUpperCase())}
            placeholder="TF-KJA-482-XA or plate number"
            className="w-full border-2 border-charcoal/20 rounded-xl px-4 py-4 text-lg font-mono focus:border-amber focus:outline-none mb-4"
          />
          <button
            onClick={() => submit(manualCode)}
            disabled={loading || !manualCode}
            className="w-full bg-amber text-charcoal font-bold py-4 rounded-xl text-lg disabled:opacity-40 active:scale-95 transition-all"
          >
            {loading ? 'Processing…' : 'Gate In'}
          </button>
        </div>
      )}

      {error && (
        <div className="mt-4 bg-red-50 border border-red-alert text-red-alert rounded-xl p-4 text-sm font-medium">
          {error}
        </div>
      )}
    </div>
  );
}
