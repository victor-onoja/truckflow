import useSWR from 'swr';
import { DEFAULT_TARGETS, type Targets } from '@/lib/targets';

const fetcher = (url: string) => fetch(url).then((r) => r.json()).then((r) => (r.ok ? r.data : DEFAULT_TARGETS));

/** Admin-set plant time targets; falls back to defaults until loaded. */
export function useTargets() {
  const { data, mutate } = useSWR<Targets>('/api/targets', fetcher, { revalidateOnFocus: false });
  return { targets: data ?? DEFAULT_TARGETS, refresh: mutate };
}
