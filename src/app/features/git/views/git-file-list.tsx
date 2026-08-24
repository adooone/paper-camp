import { CheckAllIcon } from '@/app/components/icons';
import { CountBadge } from '@/app/features/git/count-badge';
import { GitStatusMarker } from '@/app/features/git/git-status-marker';
import { stagePath, unstagePath } from '@/app/services/git-api';
import { useAppStore } from '@/app/stores/app-store';
import { oneLineErrorSummary } from '@/app/utils/error-summary';
import { splitPathForDisplay } from '@/app/utils/path-display';
import type { FileDiffEntry } from '@/types/index';
import { Checkbox, IconButton, ListItem, Tooltip, useToast } from '@dendelion/paper-ui';
import { useMemo, useState } from 'react';

// Matches SidebarSection (Docs/Settings sidebars) — no caps.
const sectionLabelClass = 'font-handwritten text-xs font-semibold leading-none opacity-[0.45]';

const scrollToFile = (path: string, expandDiffPath: (path: string) => void) => {
  expandDiffPath(path);
  requestAnimationFrame(() => {
    document
      .querySelector(`[data-diff-path="${CSS.escape(path)}"]`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
};

// Both status characters set (and neither '?', which pairs up for untracked) means
// part of the file is staged and part isn't — git can't be checked or unchecked.
const isPartiallyStaged = (status: string) => {
  const [x, y] = status;
  return x !== ' ' && x !== '?' && y !== ' ' && y !== '?';
};

// One row per folder carries the path once, so the file rows below it only spend
// their width on the basename — the part that actually distinguishes them.
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

export const GitFileList = () => {
  const files = useAppStore((s) => s.diffFiles);
  const activePath = useAppStore((s) => s.activeDiffPath);
  const loadDiffFiles = useAppStore((s) => s.loadDiffFiles);
  const expandDiffPath = useAppStore((s) => s.expandDiffPath);
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [bulkPending, setBulkPending] = useState(false);
  const { toast } = useToast();
  const groups = useMemo(() => groupByFolder(files ?? []), [files]);
  const allStaged = (files ?? []).length > 0 && (files ?? []).every((f) => f.staged);

  if (!files || files.length === 0) return null;

  // No bulk endpoint: fans out over per-path calls and reloads once at the end, so a
  // partial failure still reports and whatever landed shows up in that single reload.
  const toggleAll = async () => {
    const targets = files.filter((f) => f.staged === allStaged);
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

  return (
    <nav aria-label="Changed files" className="flex flex-col">
      <div className={`${sectionLabelClass} flex h-[32px] items-end justify-between pb-1`}>
        <span>Changed files</span>
        <Tooltip content={allStaged ? 'Unstage every file' : 'Stage every file'}>
          <IconButton
            variant="ghost"
            size="tiny"
            className="-mb-1"
            disabled={bulkPending}
            label={allStaged ? 'Unstage all files' : 'Stage all files'}
            onClick={toggleAll}
            icon={<CheckAllIcon />}
          />
        </Tooltip>
      </div>
      {/* Every row is exactly one 32px cell so the list tracks the ruled background. */}
      <ul className="m-0 flex list-none flex-col p-0">
        {groups.map((group) => (
          <li key={group.dir}>
            <div
              className="flex h-[32px] items-end overflow-hidden text-ellipsis whitespace-nowrap pb-1 font-mono text-3xs leading-none opacity-50"
              title={group.dir}
            >
              {group.dir}
            </div>
            <ul className="m-0 flex list-none flex-col p-0">
              {group.entries.map((entry) => (
                <li
                  key={entry.path}
                  className="pc-git-file-row flex h-[32px] min-w-0 items-end gap-1.5 pb-1"
                >
                  <Checkbox
                    checked={entry.staged}
                    indeterminate={isPartiallyStaged(entry.status)}
                    disabled={pending.has(entry.path)}
                    onChange={(e) => toggleStaged(entry, e.target.checked)}
                    aria-label={entry.staged ? `Unstage ${entry.path}` : `Stage ${entry.path}`}
                  />
                  <GitStatusMarker status={entry.status} compact />
                  <ListItem
                    size="small"
                    active={entry.path === activePath}
                    onClick={() => scrollToFile(entry.path, expandDiffPath)}
                    className="min-w-0 flex-1 items-end py-0 text-3xs"
                    action={
                      !entry.binary && (
                        <CountBadge additions={entry.additions} deletions={entry.deletions} />
                      )
                    }
                  >
                    <span
                      className="block min-w-0 overflow-hidden text-ellipsis whitespace-nowrap font-mono text-3xs"
                      title={entry.path}
                    >
                      {splitPathForDisplay(entry.path).base}
                    </span>
                  </ListItem>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </nav>
  );
};
