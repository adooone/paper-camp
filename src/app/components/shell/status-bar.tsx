import { useBranchSync } from '@/app/hooks/use-branch-sync';
import {
  selectAgentNotSignedIn,
  selectCapabilityGapCount,
  useAppStore,
} from '@/app/stores/app-store';
import { color, fontSize, space } from '@/app/styles/tokens';
import { Button, Spinner, Stamp, Tooltip, getTextureStyles, useToast } from '@dendelion/paper-ui';
import { useNavigate } from '@tanstack/react-router';
import { CommitIcon, MergeIcon, PullIcon, PushIcon } from '../icons';

const btnStyle = { fontSize: fontSize['2xs'] };

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
  const { pushing, syncing, pulling, handlePush, handleSync, handlePull } = useBranchSync();
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
      style={{
        ...getTextureStyles('kraft'),
        display: 'flex',
        alignItems: 'center',
        gap: space[3],
        height: '32px',
        padding: `0 ${space[4]}`,
        borderBottom: '1px solid rgba(0,0,0,0.08)',
        fontSize: fontSize['2xs'],
        flexShrink: 0,
        boxSizing: 'border-box',
        overflowX: 'auto',
        overflowY: 'hidden',
        whiteSpace: 'nowrap',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: space[3], flexShrink: 0 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: space[1] }}>
          <span style={{ opacity: 0.5 }}>⌥</span>
          <code style={{ color: color.textPrimary }}>{gitBranch ?? 'no branch'}</code>
        </span>
        {gitAhead > 0 && <span style={{ opacity: 0.6 }}>↑{gitAhead}</span>}
        <span style={{ opacity: 0.6 }}>
          {changedFileCount > 0 ? `${changedFileCount} changed` : 'clean'}
        </span>
        {agentActive && <Spinner size="small" label={`Agent ${activeTask?.status}…`} />}
        {agentNotSignedIn && (
          <Tooltip content="Run `claude auth login` (or `claude setup-token`) so agent tasks can run">
            <Stamp size="small" variant="warning">
              Agent not signed in
            </Stamp>
          </Tooltip>
        )}
        {capabilityGapCount > 0 && (
          <Tooltip content="Some features are disabled — open Setup to fix">
            {/* paper-ui has no unstyled/clickable Stamp, so a raw button wraps it (see docs/CODE_STYLE.md §1) */}
            <button
              type="button"
              onClick={() => navigate({ to: '/settings/$section', params: { section: 'setup' } })}
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
            >
              <Stamp size="small" variant="warning">
                Setup ({capabilityGapCount})
              </Stamp>
            </button>
          </Tooltip>
        )}
      </div>

      <div style={{ flex: 1 }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: space[2], flexShrink: 0 }}>
        <Tooltip
          content={gitBranchHygiene === 'clean-on-main' ? 'Already on clean main' : 'Sync to main'}
        >
          <Button
            variant="ghost"
            size="small"
            icon={<MergeIcon />}
            style={btnStyle}
            disabled={syncing || gitBranchHygiene === 'clean-on-main'}
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
            style={btnStyle}
            disabled={pushing || gitAhead === 0}
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
            style={btnStyle}
            disabled={pulling}
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
            style={btnStyle}
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
