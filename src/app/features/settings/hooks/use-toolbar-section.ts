import { fetchConfig, fetchToolbarHostState, saveConfig } from '@/app/services/system';
import type { PaperCampConfig, ToolbarHostState } from '@/types/index';
import { useToast } from '@dendelion/paper-ui';
import { useEffect, useState } from 'react';

export const useToolbarSection = () => {
  const [config, setConfig] = useState<PaperCampConfig | null | undefined>(undefined);
  const [hostState, setHostState] = useState<ToolbarHostState | null | undefined>(undefined);
  const [routeInput, setRouteInput] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    fetchConfig().then((c) => {
      setConfig(c);
      setRouteInput(c?.integration?.route ?? '');
    });
    fetchToolbarHostState().then(setHostState);
  }, []);

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

  const handleSaveRoute = async () => {
    const route = routeInput.trim();
    if (!config || !route || route === config.integration?.route) return;
    if (!route.startsWith('/')) {
      toast({ title: 'Failed to save', description: 'Route must start with /', variant: 'error' });
      return;
    }
    const integration = { ...config.integration, route };
    const { ok, error } = await saveConfig({ integration });
    if (ok) {
      setConfig((prev) => (prev ? { ...prev, integration } : prev));
      toast({ title: 'Saved', variant: 'success' });
    } else {
      toast({ title: 'Failed to save', description: error, variant: 'error' });
    }
  };

  return {
    config,
    hostState,
    routeInput,
    setRouteInput,
    handleToggleEnabled,
    handleSaveRoute,
  };
};
