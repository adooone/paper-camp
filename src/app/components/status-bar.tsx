import { useAppStore } from '@/app/stores/app-store';
import { color, fontSize, space } from '@/app/styles/tokens';
import { deriveCheckStatuses } from '@/app/utils/check-status';
import type { CheckStatus } from '@/types/index';
import { Button, Spinner, Stamp, Tooltip, getTextureStyles, useToast } from '@dendelion/paper-ui';
import { CommitIcon, RunIcon, WandIcon } from './icons';

const CHECK_VARIANT: Record<CheckStatus, 'success' | 'error' | 'warning' | 'neutral'> = {
  pass: 'success',
  fail: 'error',
  running: 'warning',
  stale: 'neutral',
};

// Shrinks the quick-action button labels to match the bar's 2xs text.
const btnStyle = { fontSize: fontSize['2xs'] };

/**
 * Full-width status strip under the header (IDEA-39, reworked): an at-a-glance
 * row of git state + check status, plus quick actions that fire immediately —
 * commit, run tests, fix quality — without opening the Stack panel. The Stack
 * panel stays the full control surface; the user opens it themselves.
 */
export const StatusBar = () => {
  const status = useAppStore((s) => s.status);
  const agentStatus = useAppStore((s) => s.agentStatus);
  const gitStatus = useAppStore((s) => s.gitStatus);
  const gitBranch = useAppStore((s) => s.gitBranch);
  const gitAhead = useAppStore((s) => s.gitAhead);
  const runCheck = useAppStore((s) => s.runCheck);
  const fixQuality = useAppStore((s) => s.fixQuality);
  const quickCommit = useAppStore((s) => s.quickCommit);
  const commitInFlight = useAppStore((s) => s.commitInFlight);
  const { toast } = useToast();

  const { qualityStatus, testStatus, consistencyStatus } = deriveCheckStatuses(status);
  const anyChecksRunning =
    qualityStatus === 'running' || testStatus === 'running' || consistencyStatus === 'running';
  const agentActive =
    agentStatus?.status === 'running' ||
    agentStatus?.status === 'starting' ||
    agentStatus?.status === 'stopping';

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
      {/* Left: git + agent status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: space[3], flexShrink: 0 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: space[1] }}>
          <span style={{ opacity: 0.5 }}>⌥</span>
          <code style={{ color: color.textPrimary }}>{gitBranch ?? 'no branch'}</code>
        </span>
        {gitAhead > 0 && <span style={{ opacity: 0.6 }}>↑{gitAhead}</span>}
        <span style={{ opacity: 0.6 }}>
          {changedFileCount > 0 ? `${changedFileCount} changed` : 'clean'}
        </span>
        {agentActive && <Spinner size="small" label={`Agent ${agentStatus?.status}…`} />}
      </div>

      <div style={{ flex: 1 }} />

      {/* Right: check status + immediate quick actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: space[2], flexShrink: 0 }}>
        <Tooltip content="Quality (lint + format)">
          <Stamp size="small" variant={CHECK_VARIANT[qualityStatus]}>
            Quality
          </Stamp>
        </Tooltip>
        <Tooltip content="Tests">
          <Stamp size="small" variant={CHECK_VARIANT[testStatus]}>
            Tests
          </Stamp>
        </Tooltip>
        <Tooltip content="Codebase consistency (knip + dependency-cruiser)">
          <Stamp size="small" variant={CHECK_VARIANT[consistencyStatus]}>
            Consistency
          </Stamp>
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
        <Button
          variant="ghost"
          size="small"
          icon={<RunIcon />}
          style={btnStyle}
          disabled={anyChecksRunning}
          onClick={() => runCheck('test')}
        >
          Run tests
        </Button>
        <Button
          variant="ghost"
          size="small"
          icon={<WandIcon />}
          style={btnStyle}
          disabled={anyChecksRunning || qualityStatus !== 'fail'}
          onClick={fixQuality}
        >
          Fix quality
        </Button>
      </div>
    </div>
  );
};
