'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Bell, ChartColumn, ListOrdered, LogOut, ScanLine, Settings } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { ALL_ROLES, FIELD_ROLES, OVERSIGHT_ROLES, ROLE_LABELS } from '@/lib/access';

type NavItem = { href: string; label: string; icon: LucideIcon; roles: readonly string[]; primary?: boolean };

const NAV: NavItem[] = [
  { href: '/queue', label: 'Queue', icon: ListOrdered, roles: ALL_ROLES },
  { href: '/scan', label: 'Scan', icon: ScanLine, roles: FIELD_ROLES, primary: true },
  { href: '/dashboard', label: 'Dashboard', icon: ChartColumn, roles: OVERSIGHT_ROLES },
  { href: '/notifications', label: 'Alerts', icon: Bell, roles: ALL_ROLES },
  { href: '/admin', label: 'Admin', icon: Settings, roles: ['ADMIN'] },
];

export default function Header({ role, fullName }: { role: string; fullName: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    const fetchUnread = async () => {
      const r = await fetch('/api/notifications').catch(() => null);
      if (!r?.ok) return;
      const { data } = await r.json();
      setUnread((data as Array<{ readAt: null | string }>).filter((n) => !n.readAt).length);
    };
    fetchUnread();
    const id = setInterval(fetchUnread, 30000);
    return () => clearInterval(id);
  }, [pathname]);

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  const items = NAV.filter((l) => l.roles.includes(role));
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const badge = unread > 9 ? '9+' : String(unread);

  return (
    <>
      <header className="bg-charcoal text-paper sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-6">
          <Link href="/" className="font-bold text-amber-light text-lg tracking-tight shrink-0">
            TruckFlow
          </Link>

          <nav aria-label="Main" className="hidden md:flex gap-1 flex-1 text-sm">
            {items.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                aria-current={isActive(href) ? 'page' : undefined}
                className={`relative inline-flex items-center gap-2 h-10 px-3 rounded-lg font-medium transition-colors ${
                  isActive(href) ? 'bg-white/10 text-paper' : 'text-on-dark-2 hover:text-paper hover:bg-white/5'
                }`}
              >
                <Icon className="size-4" aria-hidden />
                {label}
                {href === '/notifications' && unread > 0 && (
                  <span className="min-w-5 h-5 px-1 rounded-full bg-amber-light text-charcoal text-xs font-bold grid place-items-center">
                    {badge}<span className="sr-only"> unread</span>
                  </span>
                )}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-3 min-w-0">
            <div className="text-right leading-tight min-w-0">
              <p className="text-sm font-medium truncate">{fullName}</p>
              <p className="text-xs text-on-dark-2">{ROLE_LABELS[role] ?? role}</p>
            </div>
            <button
              onClick={logout}
              className="inline-flex items-center gap-1.5 h-10 px-2.5 rounded-lg text-sm text-on-dark-2 hover:text-paper hover:bg-white/10"
            >
              <LogOut className="size-4" aria-hidden />
              <span className="hidden sm:inline">Sign out</span>
              <span className="sr-only sm:hidden">Sign out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Thumb-reach tab bar on phones. */}
      <nav
        aria-label="Main"
        className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-surface border-t border-line pb-[env(safe-area-inset-bottom)]"
      >
        <ul className="flex items-stretch h-16">
          {items.map(({ href, label, icon: Icon, primary }) => {
            const active = isActive(href);
            return (
              <li key={href} className="flex-1">
                <Link
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={`relative h-full flex flex-col items-center justify-center gap-0.5 text-xs font-semibold ${
                    active ? 'text-charcoal' : 'text-ink-2'
                  }`}
                >
                  {primary ? (
                    <span className={`grid place-items-center size-11 -mt-1 rounded-2xl ${active ? 'bg-charcoal text-amber-light' : 'bg-amber text-charcoal'}`}>
                      <Icon className="size-6" aria-hidden />
                    </span>
                  ) : (
                    <Icon className="size-6" aria-hidden strokeWidth={active ? 2.4 : 1.8} />
                  )}
                  <span>{label}</span>
                  {href === '/notifications' && unread > 0 && (
                    <span className="absolute top-1.5 left-1/2 ml-1.5 min-w-5 h-5 px-1 rounded-full bg-danger text-white text-[11px] font-bold grid place-items-center">
                      {badge}<span className="sr-only"> unread</span>
                    </span>
                  )}
                  {active && !primary && <span className="absolute top-0 inset-x-6 h-0.5 rounded-full bg-charcoal" aria-hidden />}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
