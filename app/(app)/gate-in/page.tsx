import { redirect } from 'next/navigation';

// Gate in now lives in the unified scan screen.
export default function GateInPage() {
  redirect('/scan');
}
