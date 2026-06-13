import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then((r) => r.json()).then((r) => r.data);

export type QueueEntry = {
  id: string;
  truckPlate: string;
  driverName: string;
  visitType: string;
  currentStage: string;
  currentStageName: string;
  elapsedInStage: number | null;
  totalElapsed: number;
  queuingMinutes: number | null;
  gateInAt: string;
  queuePosition: number;
};

export function useLiveQueue() {
  const { data, error, isLoading } = useSWR<QueueEntry[]>('/api/queue', fetcher, {
    refreshInterval: 10000,
  });
  return { queue: data ?? [], error, isLoading };
}
