'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';

export default function Header({ role, fullName }: { role: string; fullName: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    const fetchUnread = async () => {
      const r = await fetch('/api/notifications');
      if (!r.ok) return;
      const { data } = await r.json();
      setUnread((data as Array<{ readAt: null | string }>).filter((n) => !n.readAt).length);
    };
    fetchUnread();
    const id = setInterval(fetchUnread, 30000);
    return () => clearInterval(id);
  }, []);

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  const navLinks = [
    { href: '/queue', label: 'Queue', roles: ['GATE_OFFICER', 'YARD_OPERATOR', 'FUELING_STAFF', 'SUPERVISOR', 'DISTRIBUTION_LEAD', 'ADMIN'] },
    { href: '/gate-in', label: 'Gate In', roles: ['GATE_OFFICER', 'ADMIN'] },
    { href: '/dashboard', label: 'Dashboard', roles: ['SUPERVISOR', 'DISTRIBUTION_LEAD', 'ADMIN'] },
    { href: '/admin', label: 'Admin', roles: ['ADMIN'] },
  ].filter((l) => l.roles.includes(role));

  return (
    <header className="bg-charcoal text-paper sticky top-0 z-50">
      <div className="max-w-lg mx-auto px-4 h-14 flex items-center gap-4">
        <span className="font-bold text-amber text-lg tracking-wide flex-shrink-0">TruckFlow</span>
        <nav className="flex gap-3 flex-1 overflow-x-auto text-sm">
          {navLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`whitespace-nowrap py-1 border-b-2 transition-colors ${
                pathname.startsWith(l.href) ? 'border-amber text-amber' : 'border-transparent text-paper/70 hover:text-paper'
              }`}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <Link href="/notifications" className="relative flex-shrink-0 p-2 rounded hover:bg-white/10">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          {unread > 0 && (
            <span className="absolute top-1 right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </Link>
        <button onClick={logout} className="text-xs text-paper/50 hover:text-paper flex-shrink-0">
          Out
        </button>
      </div>
    </header>
  );
}
