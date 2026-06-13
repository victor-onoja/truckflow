'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

type Notif = { id: string; title: string; body: string; visitId: string | null; readAt: string | null; createdAt: string };

export default function NotificationsPage() {
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () =>
    fetch('/api/notifications')
      .then((r) => r.json())
      .then((j) => { if (j.ok) setNotifs(j.data); setLoading(false); });

  useEffect(() => { load(); }, []);

  const markAllRead = async () => {
    await fetch('/api/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
    load();
  };

  const unread = notifs.filter((n) => !n.readAt).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">Notifications</h2>
        {unread > 0 && (
          <button onClick={markAllRead} className="text-sm text-amber font-semibold">
            Mark all read
          </button>
        )}
      </div>

      {loading && <div className="py-8 text-center text-charcoal/40">Loading…</div>}

      {!loading && notifs.length === 0 && (
        <div className="py-16 text-center text-charcoal/40">
          <div className="text-4xl mb-3">🔔</div>
          <p className="font-semibold">No notifications yet</p>
        </div>
      )}

      <div className="space-y-2">
        {notifs.map((n) => (
          <div
            key={n.id}
            className={`bg-white rounded-xl p-4 shadow-sm border-l-4 ${n.readAt ? 'border-charcoal/20' : 'border-amber'}`}
          >
            <div className="flex items-start justify-between gap-2">
              <p className={`font-semibold text-sm ${!n.readAt ? 'text-charcoal' : 'text-charcoal/60'}`}>{n.title}</p>
              <span className="text-xs text-charcoal/40 font-mono flex-shrink-0">
                {new Date(n.createdAt).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <p className="text-sm text-charcoal/70 mt-1">{n.body}</p>
            {n.visitId && (
              <Link href={`/visit/${n.visitId}`} className="text-xs text-amber font-semibold mt-2 block">
                View visit →
              </Link>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
