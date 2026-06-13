'use client';
import { useEffect, useState } from 'react';
import Image from 'next/image';

type Truck = {
  id: string;
  plateNumber: string;
  driverName: string;
  isActive: boolean;
  qrCodes: Array<{ codeString: string }>;
};

type User = { id: string; phone: string; fullName: string; role: string; isActive: boolean };

const ROLES = ['GATE_OFFICER', 'YARD_OPERATOR', 'FUELING_STAFF', 'SUPERVISOR', 'DISTRIBUTION_LEAD', 'ADMIN'];

export default function AdminPage() {
  const [tab, setTab] = useState<'trucks' | 'users'>('trucks');
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  // Truck form
  const [plate, setPlate] = useState('');
  const [driver, setDriver] = useState('');
  const [truckError, setTruckError] = useState('');
  const [truckLoading, setTruckLoading] = useState(false);

  // User form
  const [uPhone, setUPhone] = useState('');
  const [uPin, setUPin] = useState('');
  const [uName, setUName] = useState('');
  const [uRole, setURole] = useState('GATE_OFFICER');
  const [userError, setUserError] = useState('');
  const [userLoading, setUserLoading] = useState(false);

  // QR modal
  const [qrTruck, setQrTruck] = useState<Truck | null>(null);

  const loadTrucks = () => fetch('/api/admin/trucks').then((r) => r.json()).then((j) => { if (j.ok) setTrucks(j.data); });
  const loadUsers = () => fetch('/api/admin/users').then((r) => r.json()).then((j) => { if (j.ok) setUsers(j.data); });

  useEffect(() => { loadTrucks(); loadUsers(); }, []);

  const addTruck = async (e: React.FormEvent) => {
    e.preventDefault(); setTruckError(''); setTruckLoading(true);
    const r = await fetch('/api/admin/trucks', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plateNumber: plate, driverName: driver }),
    });
    const j = await r.json();
    setTruckLoading(false);
    if (!j.ok) { setTruckError(j.error); return; }
    setPlate(''); setDriver(''); loadTrucks();
  };

  const addUser = async (e: React.FormEvent) => {
    e.preventDefault(); setUserError(''); setUserLoading(true);
    const r = await fetch('/api/admin/users', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: uPhone, pin: uPin, fullName: uName, role: uRole }),
    });
    const j = await r.json();
    setUserLoading(false);
    if (!j.ok) { setUserError(j.error); return; }
    setUPhone(''); setUPin(''); setUName(''); loadUsers();
  };

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Admin</h2>

      <div className="flex rounded-xl bg-charcoal/10 p-1 mb-5">
        {(['trucks', 'users'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-lg font-semibold text-sm capitalize transition-all ${tab === t ? 'bg-charcoal text-paper shadow' : 'text-charcoal/60'}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'trucks' && (
        <div>
          <form onSubmit={addTruck} className="bg-white rounded-xl p-4 shadow-sm mb-4">
            <h3 className="font-bold text-sm uppercase tracking-wide text-charcoal/50 mb-3">Register Truck</h3>
            <input value={plate} onChange={(e) => setPlate(e.target.value.toUpperCase())} placeholder="Plate Number (KJA-482-XA)"
              className="w-full border border-charcoal/20 rounded-lg px-3 py-3 mb-2 font-mono focus:border-amber focus:outline-none" required />
            <input value={driver} onChange={(e) => setDriver(e.target.value)} placeholder="Driver Name"
              className="w-full border border-charcoal/20 rounded-lg px-3 py-3 mb-3 focus:border-amber focus:outline-none" required />
            {truckError && <p className="text-red-alert text-sm mb-2">{truckError}</p>}
            <button type="submit" disabled={truckLoading}
              className="w-full bg-amber text-charcoal font-bold py-3 rounded-lg disabled:opacity-50">
              {truckLoading ? 'Registering…' : 'Register Truck'}
            </button>
          </form>

          <div className="space-y-2">
            {trucks.map((t) => (
              <div key={t.id} className="bg-white rounded-xl p-4 shadow-sm flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-mono font-bold">{t.plateNumber}</p>
                  <p className="text-sm text-charcoal/60">{t.driverName}</p>
                  {t.qrCodes[0] && <p className="text-xs font-mono text-charcoal/40">{t.qrCodes[0].codeString}</p>}
                </div>
                <button onClick={() => setQrTruck(t)}
                  className="bg-charcoal text-paper text-sm px-4 py-2 rounded-lg font-semibold flex-shrink-0">
                  QR
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'users' && (
        <div>
          <form onSubmit={addUser} className="bg-white rounded-xl p-4 shadow-sm mb-4">
            <h3 className="font-bold text-sm uppercase tracking-wide text-charcoal/50 mb-3">Create User</h3>
            <input value={uPhone} onChange={(e) => setUPhone(e.target.value)} placeholder="Phone" type="tel"
              className="w-full border border-charcoal/20 rounded-lg px-3 py-3 mb-2 font-mono focus:border-amber focus:outline-none" required />
            <input value={uPin} onChange={(e) => setUPin(e.target.value)} placeholder="4-digit PIN" maxLength={4}
              className="w-full border border-charcoal/20 rounded-lg px-3 py-3 mb-2 font-mono focus:border-amber focus:outline-none" required />
            <input value={uName} onChange={(e) => setUName(e.target.value)} placeholder="Full Name"
              className="w-full border border-charcoal/20 rounded-lg px-3 py-3 mb-2 focus:border-amber focus:outline-none" required />
            <select value={uRole} onChange={(e) => setURole(e.target.value)}
              className="w-full border border-charcoal/20 rounded-lg px-3 py-3 mb-3 focus:border-amber focus:outline-none">
              {ROLES.map((r) => <option key={r}>{r}</option>)}
            </select>
            {userError && <p className="text-red-alert text-sm mb-2">{userError}</p>}
            <button type="submit" disabled={userLoading}
              className="w-full bg-amber text-charcoal font-bold py-3 rounded-lg disabled:opacity-50">
              {userLoading ? 'Creating…' : 'Create User'}
            </button>
          </form>

          <div className="space-y-2">
            {users.map((u) => (
              <div key={u.id} className="bg-white rounded-xl p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold">{u.fullName}</p>
                    <p className="text-sm font-mono text-charcoal/60">{u.phone}</p>
                  </div>
                  <span className="text-xs bg-charcoal/10 px-2 py-1 rounded font-semibold">{u.role.replace('_', ' ')}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* QR Modal */}
      {qrTruck && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setQrTruck(null)}>
          <div className="bg-white rounded-2xl p-6 max-w-xs w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-lg mb-1">{qrTruck.plateNumber}</h3>
            <p className="text-sm text-charcoal/60 mb-4">{qrTruck.driverName}</p>
            <div className="border-2 border-charcoal/20 rounded-xl overflow-hidden mb-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/admin/trucks/${qrTruck.id}/qr`} alt="QR Code" className="w-full" />
            </div>
            <a href={`/api/admin/trucks/${qrTruck.id}/qr`} download={`${qrTruck.plateNumber}-qr.png`}
              className="block w-full bg-charcoal text-paper text-center py-3 rounded-xl font-bold mb-2">
              Download PNG
            </a>
            <button onClick={() => setQrTruck(null)} className="w-full border border-charcoal/30 py-3 rounded-xl font-bold">
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
