import { useToast } from '@dendelion/folk-ui';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useBranchSync } from '@/app/hooks/use-branch-sync';
import type { BatchPreview } from '@/app/services/batch-api';
import { patchEntity } from '@/app/services/content';
import { refreshPlans } from '@/app/services/query-client';
import { useAppStore } from '@/app/stores/app-store';
import { oneLineErrorSummary } from '@/app/utils/error-summary';
import { moveTarget, needsSync, pruneToReady, readyIds, unplannedIds } from '../shell/queue-model';

export interface QueueScreenState {
  load: 'loading' | 'ready';
  preview: BatchPreview | null;
  picked: ReadonlySet<string>;
  live: boolean;
  starting: boolean;
  busy: boolean;
  syncing: boolean;
  prioritising: boolean;
  needsSync: boolean;
  toggle: (id: string) => void;
  move: (id: string, direction: 1 | -1) => Promise<void>;
  run: () => Promise<void>;
  prioritise: () => Promise<void>;
  draftUnplanned: () => Promise<void>;
  markPlanned: (id: string) => Promise<void>;
}

export function useQueueScreen(): QueueScreenState {
  const preview = useAppStore((state) => state.batchPreview);
  const batchStatus = useAppStore((state) => state.batchStatus);
  const loadBatchPreview = useAppStore((state) => state.loadBatchPreview);
  const loadBatchStatus = useAppStore((state) => state.loadBatchStatus);
  const startBatch = useAppStore((state) => state.startBatch);
  const launchBatchDraft = useAppStore((state) => state.launchBatchDraft);
  const launchPrioritise = useAppStore((state) => state.launchPrioritise);
  const refreshAll = useAppStore((state) => state.refreshAll);
  const { handlePull, handleFixDivergence, pulling, fixingDivergence } = useBranchSync();
  const { toast } = useToast();
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set());
  const [seeded, setSeeded] = useState(false);
  const [starting, setStarting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [prioritising, setPrioritising] = useState(false);

  const batch = batchStatus?.batch;
  const live = Boolean(
    batch &&
      (batch.status === 'running' || batch.status === 'paused' || batch.status === 'interrupted'),
  );

  useEffect(() => {
    void loadBatchPreview();
    void loadBatchStatus();
  }, [loadBatchPreview, loadBatchStatus]);

  useEffect(() => {
    if (!preview) return;
    setPicked((current) =>
      seeded ? pruneToReady(current, preview.order) : new Set(readyIds(preview.order)),
    );
    setSeeded(true);
  }, [preview, seeded]);

  const fail = useCallback(
    (title: string) => (err: unknown) =>
      toast({
        title,
        description: oneLineErrorSummary((err as Error).message),
        variant: 'error',
      }),
    [toast],
  );

  const toggle = useCallback((id: string) => {
    setPicked((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const move = useCallback(
    async (id: string, direction: 1 | -1) => {
      const order = preview?.order ?? [];
      const slot = moveTarget(
        order.findIndex((item) => item.id === id),
        direction,
        order.length,
      );
      if (slot === null) return;
      try {
        await patchEntity(id, { order: slot });
        await Promise.all([refreshPlans(), loadBatchPreview()]);
      } catch (err) {
        fail('Could not reorder')(err);
      }
    },
    [preview, loadBatchPreview, fail],
  );

  const sync = preview ? needsSync(preview.git.level) : false;

  const run = useCallback(async () => {
    if (sync) {
      if (preview?.git.level === 'behind') await handlePull();
      else await handleFixDivergence();
      await loadBatchPreview();
      return;
    }
    setStarting(true);
    try {
      await startBatch([...picked]);
      await loadBatchStatus();
    } catch (err) {
      fail('Could not start the queue')(err);
    } finally {
      setStarting(false);
    }
  }, [
    sync,
    preview,
    picked,
    handlePull,
    handleFixDivergence,
    loadBatchPreview,
    loadBatchStatus,
    startBatch,
    fail,
  ]);

  const prioritise = useCallback(async () => {
    setPrioritising(true);
    try {
      const result = await launchPrioritise();
      toast({
        title: result.moved.length > 0 ? 'Queue reordered' : 'Already in order',
        description: result.why.join('\n') || undefined,
        variant: 'success',
      });
      await loadBatchPreview();
    } catch (err) {
      fail('Failed to prioritise')(err);
      await refreshAll();
    } finally {
      setPrioritising(false);
    }
  }, [launchPrioritise, loadBatchPreview, refreshAll, toast, fail]);

  const draftUnplanned = useCallback(async () => {
    const ids = unplannedIds(preview?.backlog ?? []);
    setBusy(true);
    try {
      await launchBatchDraft(ids);
      toast({
        title: `Drafting ${ids.length} ${ids.length === 1 ? 'idea' : 'ideas'}`,
        description: 'Each one joins the queue once it has phases.',
        variant: 'success',
      });
    } catch (err) {
      fail('Could not start drafting')(err);
    } finally {
      setBusy(false);
    }
  }, [preview, launchBatchDraft, toast, fail]);

  const markPlanned = useCallback(
    async (id: string) => {
      setBusy(true);
      try {
        await patchEntity(id, { status: 'planned' });
        await Promise.all([refreshPlans(), loadBatchPreview()]);
      } catch (err) {
        fail('Could not mark planned')(err);
      } finally {
        setBusy(false);
      }
    },
    [loadBatchPreview, fail],
  );

  return useMemo(
    () => ({
      load: preview ? 'ready' : 'loading',
      preview,
      picked,
      live,
      starting,
      busy,
      syncing: pulling || fixingDivergence,
      prioritising,
      needsSync: sync,
      toggle,
      move,
      run,
      prioritise,
      draftUnplanned,
      markPlanned,
    }),
    [
      preview,
      picked,
      live,
      starting,
      busy,
      pulling,
      fixingDivergence,
      prioritising,
      sync,
      toggle,
      move,
      run,
      prioritise,
      draftUnplanned,
      markPlanned,
    ],
  );
}
