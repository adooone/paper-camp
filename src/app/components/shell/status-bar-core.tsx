import type { AgentTaskStatus, BranchHygieneStatus } from '@/types/index';
import { Button, Spinner, Stamp, Tooltip, getTextureStyles } from '@dendelion/paper-ui';
import { CommitIcon, MergeIcon, PullIcon, PushIcon } from '../icons';

export interface StatusBarCoreProps {
  gitBranch: string | null;
  gitAhead: number;
  changedFileCount: number;
  agentActive: boolean;
  activeTaskStatus?: AgentTaskStatus;
  agentNotSignedIn: boolean;
  capabilityGapCount: number;
  gitBranchHygiene: BranchHygieneStatus | null;
  commitInFlight: boolean;
  gitActionBusy: boolean;
  pushing: boolean;
  syncing: boolean;
  pulling: boolean;
  onSync: () => void;
  onPush: () => void;
  onPull: () => void;
  onQuickCommit: () => void;
  onOpenSetup: () => void;
}

// Ambient status + immediate quick actions; the Stack panel remains the full control surface.
export const StatusBarCore = ({
  gitBranch,
  gitAhead,
  changedFileCount,
  agentActive,
  activeTaskStatus,
  agentNotSignedIn,
  capabilityGapCount,
  gitBranchHygiene,
  commitInFlight,
  gitActionBusy,
  pushing,
  syncing,
  pulling,
  onSync,
  onPush,
  onPull,
  onQuickCommit,
  onOpenSetup,
}: StatusBarCoreProps) => {
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
        {agentActive && <Spinner size="small" label={`Agent ${activeTaskStatus}…`} />}
        {agentNotSignedIn && (
          <Tooltip content="Sign in from Settings → Connections so agent tasks can run">
            {/* paper-ui has no unstyled/clickable Stamp, so a raw button wraps it (see docs/CODE_STYLE.md §1) */}
            <button
              type="button"
              onClick={onOpenSetup}
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
              onClick={onOpenSetup}
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
            onClick={onSync}
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
            onClick={onPush}
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
            onClick={onPull}
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
            onClick={onQuickCommit}
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
