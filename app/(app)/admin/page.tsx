'use client';
import { useEffect, useState } from 'react';
import { Download, QrCode, X } from 'lucide-react';
import { Button, ErrorNote } from '@/components/ui';
import { ALL_ROLES, ROLE_LABELS } from '@/lib/access';
import TargetsEditor from '@/components/TargetsEditor';

type Truck = {
  id: string;
  plateNumber: string;
  driverName: string;
  isActive: boolean;
  qrCodes: Array<{ codeString: string }>;
};

type User = { id: string; phone: string; fullName: string; role: string; isActive: boolean };

const inputCls =
  'w-full min-h-12 rounded-xl border-2 border-line bg-surface px-4 text-base focus:border-amber-ink focus:outline-none placeholder:text-ink-2/80';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm font-semibold mb-1">{label}</span>
      {children}
    </label>
  );
}

export default function AdminPage() {
  const [tab, setTab] = useState<'trucks' | 'users' | 'targets'>('trucks');
  const [trucks, setTrucks] = useState<Truck[] | null>(null);
  const [users, setUsers] = useState<User[] | null>(null);

  const [plate, setPlate] = useState('');
  const [driver, setDriver] = useState('');
  const [truckError, setTruckError] = useState('');
  const [truckLoading, setTruckLoading] = useState(false);

  const [uPhone, setUPhone] = useState('');
  const [uPin, setUPin] = useState('');
  const [uName, setUName] = useState('');
  const [uRole, setURole] = useState('GATE_OFFICER');
  const [userError, setUserError] = useState('');
  const [userLoading, setUserLoading] = useState(false);

  const [openQr, setOpenQr] = useState<string | null>(null);

  const loadTrucks = () => fetch('/api/admin/trucks').then((r) => r.json()).then((j) => setTrucks(j.ok ? j.data : []));
  const loadUsers = () => fetch('/api/admin/users').then((r) => r.json()).then((j) => setUsers(j.ok ? j.data : []));

  useEffect(() => { loadTrucks(); loadUsers(); }, []);

  const addTruck = async (e: React.FormEvent) => {
    e.preventDefault(); setTruckError(''); setTruckLoading(true);
    const r = await fetch('/api/admin/trucks', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plateNumber: plate.trim(), driverName: driver.trim() }),
    });
    const j = await r.json();
    setTruckLoading(false);
    if (!j.ok) {
      setTruckError(/Unique constraint/i.test(j.error) ? `${plate} is already registered.` : j.error);
      return;
    }
    setPlate(''); setDriver(''); setOpenQr(j.data.id); loadTrucks();
  };

  const addUser = async (e: React.FormEvent) => {
    e.preventDefault(); setUserError(''); setUserLoading(true);
    const r = await fetch('/api/admin/users', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: uPhone.trim(), pin: uPin, fullName: uName.trim(), role: uRole }),
    });
    const j = await r.json();
    setUserLoading(false);
    if (!j.ok) {
      setUserError(/Unique constraint/i.test(j.error) ? 'That phone number already has an account.' : j.error);
      return;
    }
    setUPhone(''); setUPin(''); setUName(''); loadUsers();
  };

  return (
    <div className="max-w-xl mx-auto">
      <h1 className="text-2xl font-bold tracking-tight mb-4">Admin</h1>

      <div role="tablist" className="flex rounded-xl bg-charcoal/[0.07] p-1 mb-6">
        {(['trucks', 'users', 'targets'] as const).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`flex-1 min-h-11 rounded-lg font-semibold transition-colors ${tab === t ? 'bg-surface shadow-card' : 'text-ink-2 hover:text-charcoal'}`}
          >
            {t === 'trucks' ? `Trucks${trucks ? ` (${trucks.length})` : ''}` : t === 'users' ? `People${users ? ` (${users.length})` : ''}` : 'Targets'}
          </button>
        ))}
      </div>

      {tab === 'trucks' && (
        <>
          <form onSubmit={addTruck} className="bg-surface rounded-2xl shadow-card p-5 mb-6 space-y-3">
            <h2 className="text-lg font-semibold">Register a truck</h2>
            <Field label="Plate number">
              <input value={plate} onChange={(e) => setPlate(e.target.value.toUpperCase())} placeholder="KJA-482-XA" className={`${inputCls} font-mono`} required minLength={3} autoCapitalize="characters" />
            </Field>
            <Field label="Driver">
              <input value={driver} onChange={(e) => setDriver(e.target.value)} placeholder="Full name" className={inputCls} required minLength={2} autoComplete="off" />
            </Field>
            <ErrorNote>{truckError}</ErrorNote>
            <Button type="submit" className="w-full" loading={truckLoading}>Register and make QR code</Button>
          </form>

          {trucks === null ? (
            <div className="h-40 rounded-2xl bg-charcoal/[0.05] animate-pulse" />
          ) : (
            <ul className="bg-surface rounded-2xl shadow-card divide-y divide-line">
              {trucks.map((t) => (
                <li key={t.id} className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-mono font-semibold">{t.plateNumber}</p>
                      <p className="text-sm text-ink-2 truncate">{t.driverName}</p>
                    </div>
                    <Button
                      size="md"
                      variant={openQr === t.id ? 'ghost' : 'outline'}
                      aria-expanded={openQr === t.id}
                      onClick={() => setOpenQr(openQr === t.id ? null : t.id)}
                      icon={openQr === t.id ? <X className="size-4" aria-hidden /> : <QrCode className="size-4" aria-hidden />}
                    >
                      {openQr === t.id ? 'Hide' : 'QR code'}
                    </Button>
                  </div>
                  {openQr === t.id && (
                    <div className="anim-done mt-3 flex flex-col sm:flex-row items-center gap-4 rounded-xl bg-paper p-4">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`/api/admin/trucks/${t.id}/qr`} alt={`QR code for ${t.plateNumber}`} width={160} height={160} className="size-40 rounded-lg bg-white" />
                      <div className="text-center sm:text-left">
                        <p className="text-sm text-ink-2">Print and fix to the cab door. Encodes</p>
                        <p className="font-mono text-sm">{t.qrCodes[0]?.codeString}</p>
                        <a
                          href={`/api/admin/trucks/${t.id}/qr`}
                          download={`${t.plateNumber}-qr.png`}
                          className="mt-3 inline-flex items-center gap-2 min-h-11 px-4 rounded-lg bg-charcoal text-paper font-semibold hover:bg-charcoal/85"
                        >
                          <Download className="size-4" aria-hidden /> Download PNG
                        </a>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {tab === 'users' && (
        <>
          <form onSubmit={addUser} className="bg-surface rounded-2xl shadow-card p-5 mb-6 space-y-3">
            <h2 className="text-lg font-semibold">Add a person</h2>
            <Field label="Full name">
              <input value={uName} onChange={(e) => setUName(e.target.value)} className={inputCls} required autoComplete="off" />
            </Field>
            <div className="grid grid-cols-[1fr_8rem] gap-3">
              <Field label="Phone number">
                <input value={uPhone} onChange={(e) => setUPhone(e.target.value)} type="tel" inputMode="numeric" className={`${inputCls} font-mono`} required autoComplete="off" />
              </Field>
              <Field label="4-digit PIN">
                <input
                  value={uPin}
                  onChange={(e) => setUPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  inputMode="numeric"
                  pattern="\d{4}"
                  title="Exactly 4 digits"
                  className={`${inputCls} font-mono tracking-[0.3em]`}
                  required
                  autoComplete="off"
                />
              </Field>
            </div>
            <Field label="Role">
              <select value={uRole} onChange={(e) => setURole(e.target.value)} className={inputCls}>
                {ALL_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
              </select>
            </Field>
            <ErrorNote>{userError}</ErrorNote>
            <Button type="submit" className="w-full" loading={userLoading}>Add person</Button>
          </form>

          {users === null ? (
            <div className="h-40 rounded-2xl bg-charcoal/[0.05] animate-pulse" />
          ) : (
            <ul className="bg-surface rounded-2xl shadow-card divide-y divide-line">
              {users.map((u) => (
                <li key={u.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{u.fullName}</p>
                    <p className="text-sm font-mono text-ink-2">{u.phone}</p>
                  </div>
                  <span className="text-xs font-semibold bg-charcoal/[0.07] px-2 py-1 rounded-md whitespace-nowrap">{ROLE_LABELS[u.role] ?? u.role}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {tab === 'targets' && <TargetsEditor />}
    </div>
  );
}
