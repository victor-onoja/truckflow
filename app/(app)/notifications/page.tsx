'use client';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { AlertTriangle, Bell, LogOut } from 'lucide-react';

type Notif = { id: string; title: string; body: string; visitId: string | null; readAt: string | null; createdAt: string };

const fetcher = (url: string) => fetch(url).then((r) => r.json()).then((j) => (j.ok ? j.data : []));

function when(iso: string) {
  const d = new Date(iso);
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const sameDay = d.toDateString() === new Date().toDateString();
  const time = d.toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' });
  return sameDay ? time : `${d.toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}, ${time}`;
}

export default function NotificationsPage() {
  const router = useRouter();
  const { data: notifs, isLoading, mutate } = useSWR<Notif[]>('/api/notifications', fetcher, { refreshInterval: 30000 });

  const markRead = (id?: string) =>
    fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(id ? { id } : {}),
    }).then(() => mutate());

  const open = async (n: Notif) => {
    if (!n.readAt) await markRead(n.id);
    if (n.visitId) router.push(`/visit/${n.visitId}`);
  };

  const unread = notifs?.filter((n) => !n.readAt).length ?? 0;

  return (
    <div className="max-w-xl mx-auto">
      <div className="flex items-end justify-between gap-3 mb-4">
        <h1 className="text-2xl font-bold tracking-tight">Alerts</h1>
        {unread > 0 && (
          <button onClick={() => markRead()} className="min-h-11 px-2 text-sm font-semibold text-amber-ink hover:underline">
            Mark all read
          </button>
        )}
      </div>

      {isLoading && <div className="h-40 rounded-2xl bg-charcoal/[0.05] animate-pulse" />}

      {!isLoading && notifs?.length === 0 && (
        <div className="rounded-2xl border-2 border-dashed border-line-strong px-6 py-12 text-center">
          <Bell className="size-9 mx-auto text-ink-2" strokeWidth={1.5} aria-hidden />
          <p className="font-semibold text-lg mt-3">No alerts</p>
          <p className="text-ink-2 mt-1">Gate-outs and trucks stuck past their time limit show up here.</p>
        </div>
      )}

      {!!notifs?.length && (
        <ul className="bg-surface rounded-2xl shadow-card divide-y divide-line overflow-hidden">
          {notifs.map((n) => {
            const isDelay = n.title.startsWith('Delay');
            const Icon = isDelay ? AlertTriangle : LogOut;
            return (
              <li key={n.id}>
                <button
                  onClick={() => open(n)}
                  className={`w-full text-left flex gap-3 px-4 py-3.5 hover:bg-charcoal/[0.02] ${n.readAt ? '' : 'bg-amber-wash/40'}`}
                >
                  <span className={`grid place-items-center size-9 rounded-full shrink-0 ${isDelay ? 'bg-danger-wash text-danger' : 'bg-ok-wash text-ok'}`}>
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className={`font-semibold ${n.readAt ? 'text-ink-2' : ''}`}>{n.title}</span>
                      <span className="text-xs text-ink-2 shrink-0 tnum">{when(n.createdAt)}</span>
                    </span>
                    <span className="block text-sm text-ink-2 mt-0.5">{n.body}</span>
                  </span>
                  {!n.readAt && (
                    <span className="size-2.5 mt-2 rounded-full bg-amber shrink-0">
                      <span className="sr-only">Unread</span>
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
