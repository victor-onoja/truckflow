import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { homeFor } from '@/lib/access';

export default async function Root() {
  const session = await getSession();
  if (!session) redirect('/login');
  redirect(homeFor(session.role));
}
