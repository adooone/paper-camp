import { stagePath, unstagePath } from '@/app/services/git-api';
import { useAppStore } from '@/app/stores/app-store';
import { oneLineErrorSummary } from '@/app/utils/error-summary';
import { splitPathForDisplay } from '@/app/utils/path-display';
import type { FileDiffEntry } from '@/types/index';
import { useToast } from '@dendelion/paper-ui';
import { useMemo, useState } from 'react';

function groupByFolder(files: FileDiffEntry[]): { dir: string; entries: FileDiffEntry[] }[] {
  const groups = new Map<string, FileDiffEntry[]>();
  for (const entry of files) {
    const { dir } = splitPathForDisplay(entry.path);
    const key = dir || './';
    const bucket = groups.get(key);
    if (bucket) bucket.push(entry);
    else groups.set(key, [entry]);
  }
  return [...groups].map(([dir, entries]) => ({ dir, entries }));
}

export const useGitFileList = () => {
  const files = useAppStore((s) => s.diffFiles);
  const activePath = useAppStore((s) => s.activeDiffPath);
  const loadDiffFiles = useAppStore((s) => s.loadDiffFiles);
  const expandDiffPath = useAppStore((s) => s.expandDiffPath);
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [bulkPending, setBulkPending] = useState(false);
  const { toast } = useToast();
  const groups = useMemo(() => groupByFolder(files ?? []), [files]);
  const allStaged = (files ?? []).length > 0 && (files ?? []).every((f) => f.staged);

  // No bulk endpoint: fans out over per-path calls and reloads once at the end, so a
  // partial failure still reports and whatever landed shows up in that single reload.
  const toggleAll = async () => {
    const targets = (files ?? []).filter((f) => f.staged === allStaged);
    setBulkPending(true);
    try {
      const results = await Promise.allSettled(
        targets.map((f) => (allStaged ? unstagePath(f.path) : stagePath(f.path))),
      );
      const failed = results.filter((r) => r.status === 'rejected').length;
      if (failed > 0) {
        toast({
          title: allStaged ? 'Unstage failed' : 'Stage failed',
          description: `${failed} of ${targets.length} file(s) could not be updated.`,
          variant: 'error',
        });
      }
    } finally {
      await loadDiffFiles();
      setBulkPending(false);
    }
  };

  const toggleStaged = async (entry: FileDiffEntry, next: boolean) => {
    setPending((prev) => new Set(prev).add(entry.path));
    try {
      await (next ? stagePath(entry.path) : unstagePath(entry.path));
      await loadDiffFiles();
    } catch (err) {
      toast({
        title: next ? 'Stage failed' : 'Unstage failed',
        description: oneLineErrorSummary((err as Error).message),
        variant: 'error',
      });
    } finally {
      setPending((prev) => {
        const updated = new Set(prev);
        updated.delete(entry.path);
        return updated;
      });
    }
  };

  return {
    files,
    activePath,
    expandDiffPath,
    groups,
    pending,
    bulkPending,
    allStaged,
    toggleAll,
    toggleStaged,
  };
};
