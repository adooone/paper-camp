import { fetchConfig, fetchToolbarHostState, saveConfig } from '@/app/services/system';
import { selectHasAnyAgent, useAppStore } from '@/app/stores/app-store';
import type { PaperCampConfig, ToolbarHostState } from '@/types/index';
import { useToast } from '@dendelion/paper-ui';
import { useEffect, useState } from 'react';

export const useToolbarSection = () => {
  const [config, setConfig] = useState<PaperCampConfig | null | undefined>(undefined);
  const [hostState, setHostState] = useState<ToolbarHostState | null | undefined>(undefined);
  const [installing, setInstalling] = useState(false);
  const { toast } = useToast();

  const launchInstallToolbar = useAppStore((s) => s.launchInstallToolbar);
  const hasAgent = useAppStore(selectHasAnyAgent);
  const installTask = useAppStore((s) =>
    s.agentStatus.find((t) => t.taskKind === 'install-toolbar'),
  );

  useEffect(() => {
    fetchConfig().then(setConfig);
    fetchToolbarHostState().then(setHostState);
  }, []);

  // The task card that shows this run live lives in the Stack panel, not here — once
  // it lands, this section only needs to re-read whether the fix actually took.
  useEffect(() => {
    if (installTask?.status === 'done') fetchToolbarHostState().then(setHostState);
  }, [installTask?.status]);

  const handleToggleEnabled = async () => {
    if (!config) return;
    const next = !(config.integration?.toolbar?.enabled ?? true);
    const integration = {
      ...config.integration,
      toolbar: { ...config.integration?.toolbar, enabled: next },
    };
    const { ok, error } = await saveConfig({ integration });
    if (ok) {
      setConfig((prev) => (prev ? { ...prev, integration } : prev));
      toast({ title: 'Saved', variant: 'success' });
    } else {
      toast({ title: 'Failed to save', description: error, variant: 'error' });
    }
  };

  const handleInstall = async () => {
    setInstalling(true);
    try {
      await launchInstallToolbar();
    } catch (err) {
      toast({ title: 'Failed to launch', description: (err as Error).message, variant: 'error' });
    } finally {
      setInstalling(false);
    }
  };

  const installRunning =
    installing ||
    installTask?.status === 'starting' ||
    installTask?.status === 'running' ||
    installTask?.status === 'stopping';

  return {
    config,
    hostState,
    handleToggleEnabled,
    handleInstall,
    installRunning,
    hasAgent,
  };
};
