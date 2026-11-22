import { useCallback, useEffect, useMemo } from 'react';
import { useGitFileList } from '@/app/features/git/hooks/use-git-file-list';
import { useAppStore } from '@/app/stores/app-store';
import type { FileDiffEntry } from '@/types/index';
import { isDiffCollapsed } from '../shell/diff-model';

export interface DiffScreenState {
  load: 'loading' | 'unreachable' | 'ready';
  files: FileDiffEntry[];
  allStaged: boolean;
  bulkPending: boolean;
  isPending: (path: string) => boolean;
  isCollapsed: (entry: FileDiffEntry) => boolean;
  toggleCollapsed: (entry: FileDiffEntry) => void;
  toggleStaged: (entry: FileDiffEntry) => void;
  toggleAll: () => void;
  reload: () => Promise<void>;
}

export function useDiffScreen(): DiffScreenState {
  const list = useGitFileList();
  const failed = useAppStore((state) => state.diffLoadFailed);
  const loadDiffFiles = useAppStore((state) => state.loadDiffFiles);
  const expanded = useAppStore((state) => state.manuallyExpandedDiffPaths);
  const collapsed = useAppStore((state) => state.manuallyCollapsedDiffPaths);
  const setDiffCollapsed = useAppStore((state) => state.setDiffCollapsed);

  useEffect(() => {
    void loadDiffFiles();
    const onFocus = () => void loadDiffFiles();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [loadDiffFiles]);

  const isCollapsed = useCallback(
    (entry: FileDiffEntry) =>
      isDiffCollapsed(entry, {
        expanded: expanded.has(entry.path),
        collapsed: collapsed.has(entry.path),
      }),
    [expanded, collapsed],
  );

  const { files, pending, bulkPending, allStaged, toggleAll, toggleStaged } = list;

  return useMemo(
    () => ({
      load: files ? 'ready' : failed ? 'unreachable' : 'loading',
      files: files ?? [],
      allStaged,
      bulkPending,
      isPending: (path) => pending.has(path),
      isCollapsed,
      toggleCollapsed: (entry) => setDiffCollapsed(entry.path, !isCollapsed(entry)),
      toggleStaged: (entry) => void toggleStaged(entry, !entry.staged),
      toggleAll: () => void toggleAll(),
      reload: loadDiffFiles,
    }),
    [
      files,
      failed,
      allStaged,
      bulkPending,
      pending,
      isCollapsed,
      setDiffCollapsed,
      toggleStaged,
      toggleAll,
      loadDiffFiles,
    ],
  );
}
