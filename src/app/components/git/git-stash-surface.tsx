import { fetchStashDiff } from '@/app/services/git-api';
import { useAppStore } from '@/app/stores/app-store';
import type { GitStashEntry } from '@/types/index';
import { Button, Stamp } from '@dendelion/paper-ui';
import { useState } from 'react';

const formatStashAge = (days: number) =>
  days <= 0 ? 'today' : days === 1 ? '1 day ago' : `${days} days ago`;

const RECOVERY_HINT =
  'A sync pop failed and left work parked here. Recover with `git restore --source=origin/main --staged --worktree .` then `git merge --ff-only`.';

const StashEntryRow = ({ entry }: { entry: GitStashEntry }) => {
  const [diff, setDiff] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showing, setShowing] = useState(false);

  const handleToggle = async () => {
    if (showing) {
      setShowing(false);
      return;
    }
    setShowing(true);
    if (diff !== null || loading) return;
    setLoading(true);
    setError(null);
    try {
      setDiff(await fetchStashDiff(entry.index));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <Button variant="link" onClick={handleToggle} className="text-watercolor-amber-dark">
        {entry.branch}: {entry.message} · {formatStashAge(entry.ageDays)}
      </Button>
      {showing && (
        <pre className="m-0 max-h-64 overflow-auto whitespace-pre-wrap font-mono text-2xs opacity-80">
          {loading ? 'Loading…' : (error ?? diff)}
        </pre>
      )}
    </div>
  );
};

export const GitStashSurface = () => {
  const stashes = useAppStore((s) => s.gitStashes);
  const [expanded, setExpanded] = useState(false);
  if (stashes.length === 0) return null;

  const warning = stashes.some((s) => s.own);

  return (
    <div>
      <Stamp
        size="small"
        variant={warning ? 'warning' : 'neutral'}
        onClick={() => setExpanded((prev) => !prev)}
        pressed={expanded}
      >
        {stashes.length} stash{stashes.length === 1 ? '' : 'es'}
      </Stamp>
      {expanded && (
        <div className="mt-2 flex flex-col gap-2">
          {warning && <p className="m-0 text-2xs opacity-80">{RECOVERY_HINT}</p>}
          {stashes.map((entry) => (
            <StashEntryRow key={entry.index} entry={entry} />
          ))}
        </div>
      )}
    </div>
  );
};
