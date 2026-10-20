import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import Header from '@/components/Header';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/login');

  return (
    <div className="flex flex-col min-h-full">
      <Header role={session.role} fullName={session.fullName} />
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 pt-5 pb-28 md:pb-10">{children}</main>
    </div>
  );
}
