import { useAppStore } from '@/app/stores/app-store';
import { space } from '@/app/styles/tokens';
import type { CheckStatus } from '@/types/index';
import { IconButton, Menu, type MenuEntry, Spinner, Stamp, Tooltip } from '@dendelion/paper-ui';

const KebabIcon = () => (
  <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
    <circle cx="10" cy="4" r="1.6" />
    <circle cx="10" cy="10" r="1.6" />
    <circle cx="10" cy="16" r="1.6" />
  </svg>
);

const CHECK_VARIANT: Record<CheckStatus, 'success' | 'error' | 'warning' | 'neutral'> = {
  pass: 'success',
  fail: 'error',
  running: 'warning',
  stale: 'neutral',
};

interface HeaderStatusClusterProps {
  // Opens the Stack panel so its full findings/agent-log detail is reachable —
  // the cluster stays a persistent summary, not a replacement for that detail.
  onOpenStack: () => void;
  // Summons the commit Modal (IDEA-39 phase 4) — the commit form no longer
  // lives in the Stack panel, so this is the only way to reach it.
  onOpenCommit: () => void;
}

/**
 * Persistent header status cluster (IDEA-39): a Spinner while an agent task
 * runs, colored check Stamps, and a Tooltip+Menu for the commit/run/fix/inspect
 * actions. Reads the same store state the Stack panel does, so closing the
 * Stack never means flying blind — this is the ambient signal now, and it
 * supersedes the collapsed-rail spinner/red-dot IDEA-34 shipped.
 */
export const HeaderStatusCluster = ({ onOpenStack, onOpenCommit }: HeaderStatusClusterProps) => {
  const status = useAppStore((s) => s.status);
  const consistency = useAppStore((s) => s.consistency);
  const agentStatus = useAppStore((s) => s.agentStatus);
  const gitStatus = useAppStore((s) => s.gitStatus);
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

  const menuItems: MenuEntry[] = [
    {
      id: 'commit',
      label: changedFileCount > 0 ? `Commit (${changedFileCount})` : 'Commit',
      onSelect: onOpenCommit,
    },
    { id: 'sep-commit', type: 'separator' },
    {
      id: 'run-tests',
      label: 'Run tests',
      disabled: anyChecksRunning,
      onSelect: () => runCheck('test'),
    },
    {
      id: 'fix-quality',
      label: 'Fix quality',
      disabled: anyChecksRunning || qualityStatus !== 'fail',
      onSelect: fixQuality,
    },
    { id: 'sep', type: 'separator' },
    {
      id: 'view-findings',
      label: 'View findings',
      disabled: !anyChecksFailing,
      onSelect: onOpenStack,
    },
  ];

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: space[2], marginLeft: space[4] }}>
      {agentActive && <Spinner size="small" label={`Agent ${agentStatus?.status}…`} />}
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
      <Menu
        align="end"
        items={menuItems}
        trigger={
          <IconButton
            variant="ghost"
            size="small"
            label="Agent and check actions"
            icon={<KebabIcon />}
          />
        }
      />
    </div>
  );
};
