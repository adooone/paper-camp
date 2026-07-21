import { selectCapabilityGapCount, useAppStore } from '@/app/stores/app-store';
import { color, fontSize, space } from '@/app/styles/tokens';
import { deriveCheckStatuses } from '@/app/utils/check-status';
import type { CheckStatus } from '@/types/index';
import { Button, Spinner, Stamp, Tooltip, getTextureStyles, useToast } from '@dendelion/paper-ui';
import { useNavigate } from '@tanstack/react-router';
import { CommitIcon, RunIcon, WandIcon } from '../icons';

const CHECK_VARIANT: Record<CheckStatus, 'success' | 'error' | 'warning' | 'neutral'> = {
  pass: 'success',
  fail: 'error',
  running: 'warning',
  stale: 'neutral',
};

const btnStyle = { fontSize: fontSize['2xs'] };

// Ambient status + immediate quick actions; the Stack panel remains the full control surface.
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
  const capabilityGapCount = useAppStore(selectCapabilityGapCount);
  const { toast } = useToast();
  const navigate = useNavigate();

  const { qualityStatus, testStatus, consistencyStatus } = deriveCheckStatuses(status);
  const anyChecksRunning =
    qualityStatus === 'running' || testStatus === 'running' || consistencyStatus === 'running';
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
        {capabilityGapCount > 0 && (
          <Tooltip content="Some features are disabled — open Setup to fix">
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
