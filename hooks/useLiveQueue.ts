import useSWR from 'swr';
import type { QueueEntry } from '@/lib/client-types';

type Stamped = { rows: QueueEntry[]; at: number };

const fetcher = (url: string): Promise<Stamped> =>
  fetch(url)
    .then((r) => r.json())
    .then((r) => {
      if (!r.ok) throw new Error(r.error);
      return { rows: r.data, at: Date.now() };
    });

export type { QueueEntry };

export function useLiveQueue() {
  const { data, error, isLoading, mutate } = useSWR<Stamped>('/api/queue', fetcher, {
    refreshInterval: 10000,
    revalidateOnFocus: true,
  });
  return { queue: data?.rows ?? [], updatedAt: data?.at ?? null, error, isLoading, refresh: mutate };
}
