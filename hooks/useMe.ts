import useSWR from 'swr';

type Me = { userId: string; role: string; fullName: string };

const fetcher = (url: string) => fetch(url).then((r) => r.json()).then((r) => (r.ok ? r.data : null));

export function useMe() {
  const { data } = useSWR<Me | null>('/api/auth/me', fetcher, { revalidateOnFocus: false });
  return data ?? null;
}
