import { useBranchSync } from '@/app/hooks/use-branch-sync';
import {
  selectAgentNotSignedIn,
  selectCapabilityGapCount,
  useAppStore,
} from '@/app/stores/app-store';
import { Button, Spinner, Stamp, Tooltip, getTextureStyles, useToast } from '@dendelion/paper-ui';
import { useNavigate } from '@tanstack/react-router';
import { CommitIcon, MergeIcon, PullIcon, PushIcon } from '../icons';

// Ambient status + immediate quick actions; the Stack panel remains the full control surface.
export const StatusBar = () => {
  const agentStatus = useAppStore((s) => s.agentStatus);
  const gitStatus = useAppStore((s) => s.gitStatus);
  const gitBranch = useAppStore((s) => s.gitBranch);
  const gitAhead = useAppStore((s) => s.gitAhead);
  const gitBranchHygiene = useAppStore((s) => s.gitBranchHygiene);
  const quickCommit = useAppStore((s) => s.quickCommit);
  const commitInFlight = useAppStore((s) => s.commitInFlight);
  const capabilityGapCount = useAppStore(selectCapabilityGapCount);
  const agentNotSignedIn = useAppStore(selectAgentNotSignedIn);
  const { pushing, syncing, pulling, gitActionBusy, handlePush, handleSync, handlePull } =
    useBranchSync();
  const { toast } = useToast();
  const navigate = useNavigate();

  const activeTask = agentStatus.find(
    (t) => t.status === 'running' || t.status === 'starting' || t.status === 'stopping',
  );
  const agentActive = activeTask !== undefined;

  const changedFileCount = gitStatus?.length ?? 0;

  const handleQuickCommit = async () => {
    if (commitInFlight || changedFileCount === 0) return;
    const result = await quickCommit();
    if (result.ok) {
      toast({
        title: 'Committed',
        description: result.warning ?? result.title,
        variant: result.warning ? 'warning' : 'success',
      });
    } else {
      toast({ title: 'Commit failed', description: result.error, variant: 'error' });
    }
  };

  return (
    <div
      style={getTextureStyles('kraft')}
      className="flex items-center gap-3 h-8 px-4 border-b border-black/[8%] text-2xs flex-shrink-0 box-border overflow-x-auto overflow-y-hidden whitespace-nowrap"
    >
      <div className="flex items-center gap-3 flex-shrink-0">
        <span className="flex items-center gap-1">
          <span className="opacity-50">⌥</span>
          <code className="text-ink-900">{gitBranch ?? 'no branch'}</code>
        </span>
        {gitAhead > 0 && <span className="opacity-60">↑{gitAhead}</span>}
        <span className="opacity-60">
          {changedFileCount > 0 ? `${changedFileCount} changed` : 'clean'}
        </span>
        {agentActive && <Spinner size="small" label={`Agent ${activeTask?.status}…`} />}
        {agentNotSignedIn && (
          <Tooltip content="Sign in from Settings → Connections so agent tasks can run">
            <button
              type="button"
              onClick={() => navigate({ to: '/settings/$section', params: { section: 'setup' } })}
              className="bg-none bg-transparent border-none p-0 cursor-pointer"
            >
              <Stamp size="small" variant="warning">
                Agent not signed in
              </Stamp>
            </button>
          </Tooltip>
        )}
        {capabilityGapCount > 0 && (
          <Tooltip content="Some features are disabled — open Setup to fix">
            {/* paper-ui has no unstyled/clickable Stamp, so a raw button wraps it (see docs/CODE_STYLE.md §1) */}
            <button
              type="button"
              onClick={() => navigate({ to: '/settings/$section', params: { section: 'setup' } })}
              className="bg-none bg-transparent border-none p-0 cursor-pointer"
            >
              <Stamp size="small" variant="warning">
                Setup ({capabilityGapCount})
              </Stamp>
            </button>
          </Tooltip>
        )}
      </div>

      <div className="flex-1" />

      <div className="flex items-center gap-2 flex-shrink-0">
        <Tooltip
          content={gitBranchHygiene === 'clean-on-main' ? 'Already on clean main' : 'Sync to main'}
        >
          <Button
            variant="ghost"
            size="small"
            icon={<MergeIcon />}
            className="text-2xs"
            disabled={gitActionBusy || gitBranchHygiene === 'clean-on-main'}
            onClick={handleSync}
          >
            {syncing ? 'Syncing…' : 'Sync to main'}
          </Button>
        </Tooltip>
        <Tooltip content="Push commits to origin">
          <Button
            variant="ghost"
            size="small"
            icon={<PushIcon />}
            className="text-2xs"
            disabled={gitActionBusy || gitAhead === 0}
            onClick={handlePush}
          >
            {pushing ? 'Pushing…' : gitAhead > 0 ? `Push (${gitAhead})` : 'Push'}
          </Button>
        </Tooltip>
        <Tooltip content="Fast-forward the current branch from origin">
          <Button
            variant="ghost"
            size="small"
            icon={<PullIcon />}
            className="text-2xs"
            disabled={gitActionBusy}
            onClick={handlePull}
          >
            {pulling ? 'Pulling…' : 'Pull'}
          </Button>
        </Tooltip>
        <Tooltip content="Commit all changes with an auto-suggested message">
          <Button
            variant="ghost"
            size="small"
            icon={<CommitIcon />}
            className="text-2xs"
            disabled={commitInFlight || changedFileCount === 0}
            onClick={handleQuickCommit}
          >
            {commitInFlight
              ? 'Committing…'
              : changedFileCount > 0
                ? `Commit (${changedFileCount})`
                : 'Commit'}
          </Button>
        </Tooltip>
      </div>
    </div>
  );
};
