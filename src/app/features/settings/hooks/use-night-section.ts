import type { NightStatus } from '@/app/services/system';
import {
  fetchConfig,
  fetchNightStatus,
  pauseNightShift,
  runNightPassNow,
  saveConfig,
  toggleNightShift,
} from '@/app/services/system';
import { NIGHT_BUILTIN_CHECKS } from '@/core/night-checks';
import type { NightCheckId, NightCustomCheck, PaperCampConfig } from '@/types/index';
import { useToast } from '@dendelion/paper-ui';
import { useCallback, useEffect, useState } from 'react';

export interface KeyedNightCustomCheck extends NightCustomCheck {
  id: string;
}

const isCompleteCustomCheck = (c: NightCustomCheck) =>
  c.name.trim() !== '' && c.prompt.trim() !== '';

const stripId = <T extends { id: string }>({ id: _id, ...rest }: T) => rest;

// Reminting ids on the post-save reload would remount every row, losing focus and
// any sibling edit not yet blurred — so rows keep their id, matched back by name.
function reconcileRows(
  prev: KeyedNightCustomCheck[],
  next: NightCustomCheck[],
): KeyedNightCustomCheck[] {
  const usedIds = new Set<string>();
  const merged = next.map((row) => {
    const match = row.name
      ? prev.find((p) => !usedIds.has(p.id) && p.name === row.name)
      : undefined;
    if (!match) return { ...row, id: crypto.randomUUID() };
    usedIds.add(match.id);
    const { id, ...matchRest } = match;
    return JSON.stringify(matchRest) === JSON.stringify(row) ? match : { ...row, id };
  });
  const pending = prev.filter(
    (p) => !usedIds.has(p.id) && (p.name.trim() === '' || p.prompt.trim() === ''),
  );
  return [...merged, ...pending];
}

export const useNightSection = () => {
  const [config, setConfig] = useState<PaperCampConfig | null | undefined>(undefined);
  const [status, setStatus] = useState<NightStatus | null | undefined>(undefined);
  const [customChecks, setCustomChecks] = useState<KeyedNightCustomCheck[]>([]);
  const [running, setRunning] = useState(false);
  const { toast } = useToast();

  const reloadFromConfig = useCallback((c: PaperCampConfig | null) => {
    setConfig(c);
    setCustomChecks((prev) => reconcileRows(prev, c?.night?.customChecks ?? []));
  }, []);

  const reload = useCallback(async () => {
    const [freshConfig, freshStatus] = await Promise.all([fetchConfig(), fetchNightStatus()]);
    reloadFromConfig(freshConfig);
    setStatus(freshStatus);
  }, [reloadFromConfig]);

  useEffect(() => {
    reload();
  }, [reload]);

  const handleToggleEnabled = async () => {
    if (!status) return;
    const { ok, error } = await toggleNightShift(!status.enabled);
    if (ok) {
      const fresh = await fetchNightStatus();
      setStatus(fresh);
    } else {
      toast({ title: 'Failed to save', description: error, variant: 'error' });
    }
  };

  const handleTogglePause = async () => {
    if (!status) return;
    const { ok, error, data } = await pauseNightShift(status.pausedUntil === null);
    if (ok) {
      setStatus((prev) => (prev ? { ...prev, pausedUntil: data?.pausedUntil ?? null } : prev));
    } else {
      toast({ title: 'Failed to save', description: error, variant: 'error' });
    }
  };

  const handleRunNow = async () => {
    setRunning(true);
    const { ok, error } = await runNightPassNow();
    setRunning(false);
    if (ok) {
      toast({ title: 'Night pass started', variant: 'success' });
    } else {
      toast({ title: 'Failed to start', description: error, variant: 'error' });
    }
  };

  const saveChecks = async (checks: Partial<Record<NightCheckId, boolean>>) => {
    const { ok, error } = await saveConfig({ night: { ...config?.night, checks } });
    if (ok) {
      const fresh = await fetchConfig();
      reloadFromConfig(fresh);
    } else {
      toast({ title: 'Failed to save', description: error, variant: 'error' });
    }
  };

  const handleToggleCheck = (id: NightCheckId) => {
    const current = config?.night?.checks ?? {};
    const enabled = current[id] ?? true;
    saveChecks({ ...current, [id]: !enabled });
  };

  const commitCustomChecks = async (next: KeyedNightCustomCheck[]) => {
    const complete = next.filter(isCompleteCustomCheck).map(stripId);
    const { ok, error } = await saveConfig({
      night: { ...config?.night, customChecks: complete.length ? complete : undefined },
    });
    if (ok) {
      const fresh = await fetchConfig();
      reloadFromConfig(fresh);
    } else {
      toast({ title: 'Failed to save', description: error, variant: 'error' });
    }
  };

  const addCustomCheck = () =>
    setCustomChecks((prev) => [...prev, { id: crypto.randomUUID(), name: '', prompt: '' }]);

  const updateCustomCheck = (id: string, next: NightCustomCheck) => {
    const nextChecks = customChecks.map((c) => (c.id === id ? { ...next, id } : c));
    setCustomChecks(nextChecks);
    commitCustomChecks(nextChecks);
  };

  const removeCustomCheck = (id: string) => {
    const nextChecks = customChecks.filter((c) => c.id !== id);
    setCustomChecks(nextChecks);
    commitCustomChecks(nextChecks);
  };

  return {
    config,
    status,
    customChecks,
    running,
    builtinChecks: NIGHT_BUILTIN_CHECKS,
    handleToggleEnabled,
    handleTogglePause,
    handleRunNow,
    handleToggleCheck,
    addCustomCheck,
    updateCustomCheck,
    removeCustomCheck,
  };
};
