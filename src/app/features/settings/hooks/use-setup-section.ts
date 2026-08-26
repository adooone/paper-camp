import { connectService, fetchConfig, fetchConnections, saveConfig } from '@/app/services/system';
import type { ConnectionResult } from '@/types/index';
import { useToast } from '@dendelion/paper-ui';
import { useCallback, useEffect, useState } from 'react';

export const useSetupSection = () => {
  const [connections, setConnections] = useState<ConnectionResult[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [reloadingId, setReloadingId] = useState<string | null>(null);
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [setupDismissed, setSetupDismissed] = useState(false);
  const { toast } = useToast();

  const applyConnections = useCallback((result: ConnectionResult[] | null) => {
    if (result === null) {
      setLoadFailed(true);
      return;
    }
    setLoadFailed(false);
    setConnections(result);
  }, []);

  useEffect(() => {
    fetchConnections().then(applyConnections);
    fetchConfig().then((c) => setSetupDismissed(c?.setupDismissed ?? false));
  }, [applyConnections]);

  const handleRecheck = async (id: string) => {
    setReloadingId(id);
    applyConnections(await fetchConnections());
    setReloadingId(null);
  };

  const handleConnect = async (id: string) => {
    setConnectingId(id);
    const updated = await connectService(id);
    if (updated) {
      setConnections((prev) => prev?.map((c) => (c.id === id ? updated : c)) ?? prev);
    } else {
      toast({ title: 'Failed to connect', variant: 'error' });
    }
    setConnectingId(null);
  };

  const handleDismissToggle = async () => {
    const next = !setupDismissed;
    const { ok } = await saveConfig({ setupDismissed: next });
    if (ok) {
      setSetupDismissed(next);
      toast({ title: 'Saved', variant: 'success' });
    } else {
      toast({ title: 'Failed to save', variant: 'error' });
    }
  };

  const allOk = connections?.every((c) => c.status === 'ok') ?? true;
  const externalConnections = connections?.filter((c) => c.kind === 'external') ?? [];
  const localConnections = connections?.filter((c) => c.kind === 'local') ?? [];

  return {
    connections,
    loadFailed,
    reloadingId,
    connectingId,
    setupDismissed,
    handleRecheck,
    handleConnect,
    handleDismissToggle,
    allOk,
    externalConnections,
    localConnections,
  };
};
