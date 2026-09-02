import { useDeskDiscovery } from '@/app/hooks/use-desk-discovery';
import { fetchConfig, saveConfig } from '@/app/services/system';
import type { DeskCheck, DeskCi, DeskConfig, DeskService, PaperCampConfig } from '@/types/index';
import { useToast } from '@dendelion/paper-ui';
import { useCallback, useEffect, useState } from 'react';

export interface KeyedDeskService extends DeskService {
  id: string;
}

export interface KeyedDeskCheck extends DeskCheck {
  id: string;
}

const EMPTY_CI: DeskCi = { repo: '' };

const isCompleteService = (s: DeskService) => s.name.trim() !== '' && s.cmd.trim() !== '';
const isCompleteCheck = (c: DeskCheck) => c.name.trim() !== '' && c.cmd.trim() !== '';

const stripId = <T extends { id: string }>({ id: _id, ...rest }: T) => rest;

// Reminting ids on the post-save reload would remount every row, losing focus and
// any sibling edit not yet blurred — so rows keep their id, matched back by cmd.
function reconcileRows<T extends { name: string; cmd: string }>(
  prev: Array<T & { id: string }>,
  next: T[],
): Array<T & { id: string }> {
  const usedIds = new Set<string>();
  const merged = next.map((row) => {
    const match = row.cmd ? prev.find((p) => !usedIds.has(p.id) && p.cmd === row.cmd) : undefined;
    if (!match) return { ...row, id: crypto.randomUUID() };
    usedIds.add(match.id);
    const { id, ...matchRest } = match;
    return JSON.stringify(matchRest) === JSON.stringify(row) ? match : { ...row, id };
  });
  const pending = prev.filter(
    (p) => !usedIds.has(p.id) && (p.name.trim() === '' || p.cmd.trim() === ''),
  );
  return [...merged, ...pending];
}

export const useDeskSection = () => {
  const [config, setConfig] = useState<PaperCampConfig | null | undefined>(undefined);
  const [services, setServices] = useState<KeyedDeskService[]>([]);
  const [checks, setChecks] = useState<KeyedDeskCheck[]>([]);
  const [ci, setCi] = useState<DeskCi>(EMPTY_CI);
  const { toast } = useToast();
  const discovery = useDeskDiscovery();

  const reloadFromConfig = useCallback((c: PaperCampConfig | null) => {
    setConfig(c);
    setServices((prev) => reconcileRows(prev, c?.desk?.services ?? []));
    setChecks((prev) => reconcileRows(prev, c?.desk?.checks ?? []));
    setCi(c?.desk?.ci ?? EMPTY_CI);
  }, []);

  useEffect(() => {
    fetchConfig().then(reloadFromConfig);
  }, [reloadFromConfig]);

  const reloadDesk = useCallback(async () => {
    const fresh = await fetchConfig();
    reloadFromConfig(fresh);
  }, [reloadFromConfig]);

  const commit = async (
    nextServices: KeyedDeskService[],
    nextChecks: KeyedDeskCheck[],
    nextCi: DeskCi,
  ) => {
    const completeServices = nextServices.filter(isCompleteService).map(stripId);
    const completeChecks = nextChecks.filter(isCompleteCheck).map(stripId);
    const resolvedCi = nextCi.repo.trim() ? nextCi : undefined;
    const desk: DeskConfig = {
      services: completeServices.length ? completeServices : undefined,
      checks: completeChecks.length ? completeChecks : undefined,
      ci: resolvedCi,
    };
    const { ok, error } = await saveConfig({ desk });
    if (ok) {
      await discovery.reloadCurrent();
      const fresh = await fetchConfig();
      reloadFromConfig(fresh);
      toast({ title: 'Saved', variant: 'success' });
    } else {
      toast({ title: 'Failed to save', description: error, variant: 'error' });
    }
  };

  const addService = () =>
    setServices((prev) => [...prev, { id: crypto.randomUUID(), name: '', cmd: '' }]);

  const updateService = (id: string, next: DeskService) => {
    const nextServices = services.map((s) => (s.id === id ? { ...next, id } : s));
    setServices(nextServices);
    commit(nextServices, checks, ci);
  };

  const removeService = (id: string) => {
    const nextServices = services.filter((s) => s.id !== id);
    setServices(nextServices);
    commit(nextServices, checks, ci);
  };

  const addCheck = () =>
    setChecks((prev) => [...prev, { id: crypto.randomUUID(), name: '', cmd: '' }]);

  const updateCheck = (id: string, next: DeskCheck) => {
    const nextChecks = checks.map((c) => (c.id === id ? { ...next, id } : c));
    setChecks(nextChecks);
    commit(services, nextChecks, ci);
  };

  const removeCheck = (id: string) => {
    const nextChecks = checks.filter((c) => c.id !== id);
    setChecks(nextChecks);
    commit(services, nextChecks, ci);
  };

  const updateCi = (next: DeskCi) => {
    setCi(next);
    commit(services, checks, next);
  };

  return {
    config,
    services,
    checks,
    ci,
    proposal: discovery.proposal,
    diff: discovery.diff,
    discovering: discovery.discovering,
    addService,
    updateService,
    removeService,
    addCheck,
    updateCheck,
    removeCheck,
    updateCi,
    startDiscovery: discovery.startDiscovery,
    cancelProposal: discovery.cancelProposal,
    applyProposal: async (next: DeskConfig) => {
      await discovery.applyProposal(next);
      await reloadDesk();
    },
  };
};
