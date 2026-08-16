import { CountBadge } from '@/app/features/git/count-badge';
import { FilePath } from '@/app/features/git/file-path';
import { GitStatusMarker } from '@/app/features/git/git-status-marker';
import { stagePath, unstagePath } from '@/app/services/git-api';
import { useAppStore } from '@/app/stores/app-store';
import { oneLineErrorSummary } from '@/app/utils/error-summary';
import type { FileDiffEntry } from '@/types/index';
import { Checkbox, ListItem, Stamp, useToast } from '@dendelion/paper-ui';
import { useState } from 'react';

const sectionLabelClass = 'text-2xs font-semibold tracking-[0.08em] uppercase text-ink-300 mb-2';

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

export const GitFileList = () => {
  const files = useAppStore((s) => s.diffFiles);
  const activePath = useAppStore((s) => s.activeDiffPath);
  const loadDiffFiles = useAppStore((s) => s.loadDiffFiles);
  const expandDiffPath = useAppStore((s) => s.expandDiffPath);
  const [pending, setPending] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  if (!files || files.length === 0) return null;

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
    <div className="flex flex-col gap-8 -mt-5">
      <div>
        <div className={sectionLabelClass}>Changed files</div>
        <div className="flex flex-col gap-1">
          {files.map((entry) => (
            <div key={entry.path} className="flex items-center gap-2">
              <Checkbox
                checked={entry.staged}
                indeterminate={isPartiallyStaged(entry.status)}
                disabled={pending.has(entry.path)}
                onChange={(e) => toggleStaged(entry, e.target.checked)}
                aria-label={entry.staged ? `Unstage ${entry.path}` : `Stage ${entry.path}`}
              />
              <GitStatusMarker status={entry.status} />
              <ListItem
                size="small"
                active={entry.path === activePath}
                onClick={() => scrollToFile(entry.path, expandDiffPath)}
                className="flex-1"
                action={
                  <span className="flex items-center gap-2">
                    {entry.staged && <Stamp size="small">staged</Stamp>}
                    {!entry.binary && (
                      <CountBadge additions={entry.additions} deletions={entry.deletions} />
                    )}
                  </span>
                }
              >
                <FilePath path={entry.path} className="text-2xs" />
              </ListItem>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
