import { fetchTailnetPeerRuntimes } from '@/app/services/system';
import type { TailnetPeerRuntime } from '@/types/index';
import { useCallback, useEffect, useState } from 'react';

export interface UseTailnetPeersResult {
  peers: TailnetPeerRuntime[];
  loading: boolean;
  refresh: () => void;
}

export function useTailnetPeers(): UseTailnetPeersResult {
  const [peers, setPeers] = useState<TailnetPeerRuntime[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback((refresh: boolean) => {
    setLoading(true);
    fetchTailnetPeerRuntimes(refresh)
      .then((result) => setPeers(result ?? []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load(false);
  }, [load]);

  return { peers, loading, refresh: () => load(true) };
}
