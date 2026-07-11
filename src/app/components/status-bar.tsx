import { useAppStore } from '@/app/stores/app-store';
import { color, fontSize, space } from '@/app/styles/tokens';
import type { CheckStatus } from '@/types/index';
import { Button, Spinner, Stamp, Tooltip, getTextureStyles } from '@dendelion/paper-ui';

// Small monochrome glyphs for the quick actions — paper-ui's icon set doesn't
// cover run/fix/commit/inspect, so these are inline and inherit currentColor.
const RunIcon = () => (
  <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
    <path d="M6 4l11 6-11 6z" />
  </svg>
);
const WandIcon = () => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    aria-hidden="true"
  >
    <path d="M4 16l8-8" />
    <path d="M13 3v3M11.5 4.5h3" />
  </svg>
);
const CommitIcon = () => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    aria-hidden="true"
  >
    <circle cx="10" cy="10" r="3" />
    <path d="M2.5 10h4.5M13 10h4.5" />
  </svg>
);
const FindingsIcon = () => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    aria-hidden="true"
  >
    <circle cx="8.5" cy="8.5" r="4.5" />
    <path d="M12 12l4.5 4.5" />
  </svg>
);

const CHECK_VARIANT: Record<CheckStatus, 'success' | 'error' | 'warning' | 'neutral'> = {
  pass: 'success',
  fail: 'error',
  running: 'warning',
  stale: 'neutral',
};

// Shrinks the quick-action button labels to match the bar's 2xs text.
const btnStyle = { fontSize: fontSize['2xs'] };

interface StatusBarProps {
  // Opens the Stack panel — the full control surface where commit, agent log,
  // and findings detail live. The bar is the ambient glance; the panel is where
  // you act.
  onOpenStack: () => void;
}

/**
 * Full-width status strip under the header (IDEA-39, reworked): an at-a-glance
 * row of git state + check status + a few quick actions, so closing the Stack
 * panel never means flying blind. Deliberately NOT the control surface — the
 * Stack panel is; commit and findings detail open there rather than here.
 */
export const StatusBar = ({ onOpenStack }: StatusBarProps) => {
  const status = useAppStore((s) => s.status);
  const consistency = useAppStore((s) => s.consistency);
  const agentStatus = useAppStore((s) => s.agentStatus);
  const gitStatus = useAppStore((s) => s.gitStatus);
  const gitBranch = useAppStore((s) => s.gitBranch);
  const gitAhead = useAppStore((s) => s.gitAhead);
  const runCheck = useAppStore((s) => s.runCheck);
  const fixQuality = useAppStore((s) => s.fixQuality);

  const qualityStatus: CheckStatus =
    status?.lint?.status === 'running' || status?.format?.status === 'running'
      ? 'running'
      : status?.lint?.status === 'fail' || status?.format?.status === 'fail'
        ? 'fail'
        : status?.lint?.status === 'stale' && status?.format?.status === 'stale'
          ? 'stale'
          : 'pass';
  const testStatus: CheckStatus = status?.test?.status ?? 'stale';
  const consistencyStatus: CheckStatus = status?.consistency?.status ?? 'stale';
  const anyChecksRunning =
    qualityStatus === 'running' || testStatus === 'running' || consistencyStatus === 'running';
  const hasDocIssues = consistency.length > 0;
  const anyChecksFailing =
    qualityStatus === 'fail' ||
    testStatus === 'fail' ||
    consistencyStatus === 'fail' ||
    hasDocIssues;
  const agentActive =
    agentStatus?.status === 'running' ||
    agentStatus?.status === 'starting' ||
    agentStatus?.status === 'stopping';

  const changedFileCount = gitStatus?.length ?? 0;

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
        overflow: 'hidden',
        whiteSpace: 'nowrap',
      }}
    >
      {/* Left: git + agent status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: space[3], minWidth: 0 }}>
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

      {/* Right: check status + quick actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: space[2] }}>
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
        <Button
          variant="ghost"
          size="small"
          icon={<CommitIcon />}
          style={btnStyle}
          onClick={onOpenStack}
        >
          {changedFileCount > 0 ? `Commit (${changedFileCount})` : 'Commit'}
        </Button>
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
        <Button
          variant="ghost"
          size="small"
          icon={<FindingsIcon />}
          style={btnStyle}
          disabled={!anyChecksFailing}
          onClick={onOpenStack}
        >
          Findings
        </Button>
      </div>
    </div>
  );
};
