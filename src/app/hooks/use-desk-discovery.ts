import { diffDeskConfig } from '@/app/features/settings/helpers';
import { discoverDesk, fetchConfig, saveConfig } from '@/app/services/system';
import type { DeskConfig } from '@/types/index';
import { useToast } from '@dendelion/paper-ui';
import { useCallback, useEffect, useState } from 'react';

export interface DeskDiscoveryState {
  configLoaded: boolean;
  current: DeskConfig | null;
  proposal: DeskConfig | null;
  diff: ReturnType<typeof diffDeskConfig> | null;
  discovering: boolean;
  startDiscovery: () => Promise<void>;
  cancelProposal: () => void;
  applyProposal: (next: DeskConfig) => Promise<void>;
  reloadCurrent: () => Promise<void>;
}

export const useDeskDiscovery = (): DeskDiscoveryState => {
  const [current, setCurrent] = useState<DeskConfig | null>(null);
  const [proposal, setProposal] = useState<DeskConfig | null>(null);
  const [discovering, setDiscovering] = useState(false);
  const [configLoaded, setConfigLoaded] = useState(false);
  const { toast } = useToast();

  const reloadCurrent = useCallback(async () => {
    const config = await fetchConfig();
    setCurrent(config?.desk ?? null);
    setConfigLoaded(true);
  }, []);

  useEffect(() => {
    reloadCurrent();
  }, [reloadCurrent]);

  const startDiscovery = async () => {
    setDiscovering(true);
    try {
      const result = await discoverDesk();
      if (!result.ok || !result.proposal) {
        toast({
          title: 'Discovery failed',
          description: result.error ?? 'No proposal returned.',
          variant: 'error',
        });
        return;
      }
      if (!configLoaded) await reloadCurrent();
      setProposal(result.proposal);
    } finally {
      setDiscovering(false);
    }
  };

  const cancelProposal = () => setProposal(null);

  const applyProposal = async (next: DeskConfig) => {
    const { ok, error } = await saveConfig({ desk: next });
    if (!ok) {
      toast({ title: 'Failed to save', description: error, variant: 'error' });
      throw new Error(error ?? 'failed to save desk config');
    }
    const fresh = await fetchConfig();
    setCurrent(fresh?.desk ?? null);
    setConfigLoaded(true);
    setProposal(null);
    toast({ title: 'Desk config applied', variant: 'success' });
  };

  const diff = proposal ? diffDeskConfig(current ?? null, proposal) : null;

  return {
    configLoaded,
    current,
    proposal,
    diff,
    discovering,
    startDiscovery,
    cancelProposal,
    applyProposal,
    reloadCurrent,
  };
};
