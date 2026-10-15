import { useDeliverChecksRow } from '@/app/features/plans/hooks';
import { entityLink } from '@/app/hooks';
import { useBranchSync } from '@/app/hooks/use-branch-sync';
import type { CheckStatus } from '@/types/index';
import {
  Button,
  IconButton,
  Menu,
  type MenuEntry,
  PullIcon,
  PushIcon,
  Stamp,
  type StampVariant,
  Tooltip,
  getSurfaceStyles,
} from '@dendelion/folk-ui';
import { surface } from '@dendelion/folk-ui/tokens';
import type { ReactNode } from 'react';
import { CommitMessageFields, type CommitMessageFieldsState } from './commit-message-fields';

const CHECK_VARIANT: Record<CheckStatus, StampVariant> = {
  pass: 'success',
  fail: 'error',
  running: 'warning',
  stale: 'neutral',
};

const DOT_CLASS: Record<CheckStatus, string> = {
  pass: 'bg-watercolor-green-dark',
  fail: 'bg-watercolor-rose-dark',
  running: 'bg-watercolor-amber-dark',
  stale: 'bg-watercolor-slate-dark',
};

const StatusDot = ({ status }: { status: CheckStatus }) => (
  <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${DOT_CLASS[status]}`} />
);

const menuItemLabel = (name: string, action: string) => (
  <span className="flex w-full items-center justify-between gap-4">
    <span>{name}</span>
    <span className="opacity-60">{action}</span>
  </span>
);

interface FixButtonProps {
  label: string;
  tooltip: string;
  variant: StampVariant;
  disabled: boolean;
  onClick: () => void;
}

const FixButton = ({ label, tooltip, variant, disabled, onClick }: FixButtonProps) => (
  <Tooltip content={tooltip}>
    <Stamp size="small" variant={variant} onClick={onClick} disabled={disabled}>
      {label}
    </Stamp>
  </Tooltip>
);

const gitStateLine = (
  hasChanges: boolean,
  fileCount: number,
  gitAhead: number,
  branch?: string,
): string => {
  const suffix = hasChanges
    ? `${fileCount} file${fileCount === 1 ? '' : 's'} changed`
    : gitAhead > 0
      ? `${gitAhead} commit${gitAhead === 1 ? '' : 's'} ready`
      : 'Up to date with origin';
  return branch ? `${branch} · ${suffix}` : suffix;
};

interface DeliverBarProps {
  files: { path: string; staged: boolean }[];
  gitAhead: number;
  branch?: string;
  commitForm: CommitMessageFieldsState;
  commitButton: ReactNode;
  /** The Git page's standalone footer: its own card surface, top border and sticky
   *  bottom-0 — the idea page's footer rides inside the phases table's panelFooter instead. */
  pinned?: boolean;
}

export const DeliverBar = ({
  files,
  gitAhead,
  branch,
  commitForm,
  commitButton,
  pinned = false,
}: DeliverBarProps) => {
  const {
    deskChecks,
    anyRunning,
    hasDocIssues,
    consistency,
    docsExpanded,
    setDocsExpanded,
    navigate,
    runDeskCheck,
    runAllChecks,
    linkedPlanFor,
    failing,
    failingCheck,
    fixState,
    fixing,
    runAutoFix,
    fixCheck,
  } = useDeliverChecksRow();
  const { pushing, pulling, gitActionBusy, handlePush, handlePull } = useBranchSync();

  const hasChanges = files.length > 0;

  const failingDeskChecks = deskChecks.filter((check) => check.status === 'fail');
  const runningCount = deskChecks.filter((check) => check.status === 'running').length;
  const totalChecks = deskChecks.length + 1;
  const failingCount = failingDeskChecks.length + (hasDocIssues ? 1 : 0);
  const firstFailingName = failingDeskChecks[0]?.name ?? (hasDocIssues ? 'Docs' : undefined);
  const allStale = deskChecks.length > 0 && deskChecks.every((check) => check.status === 'stale');

  let statusVariant: StampVariant;
  let statusLabel: string;
  if (failingCount > 0) {
    statusVariant = 'error';
    statusLabel =
      failingCount === 1
        ? `${firstFailingName} failing · 1 of ${totalChecks}`
        : `${failingCount} of ${totalChecks} failing`;
  } else if (anyRunning) {
    statusVariant = 'warning';
    statusLabel = `${runningCount} checks running…`;
  } else if (allStale) {
    statusVariant = 'neutral';
    statusLabel = 'Checks not run';
  } else {
    statusVariant = 'success';
    statusLabel = 'Checks passing';
  }

  const checkItems: MenuEntry[] = deskChecks.map((check) => {
    const autoFix = check.status === 'fail' && Boolean(check.fixCmd);
    return {
      id: `check:${check.name}`,
      label: menuItemLabel(check.name, autoFix ? 'Auto-fix' : 'Run'),
      icon: <StatusDot status={check.status} />,
      disabled: anyRunning,
      onSelect: autoFix ? () => runAutoFix(check.name) : () => runDeskCheck(check.name),
    };
  });

  const docsItem: MenuEntry = {
    id: 'check:docs',
    label: menuItemLabel(
      'Docs',
      hasDocIssues
        ? `${consistency.length} finding${consistency.length === 1 ? '' : 's'}`
        : 'no findings',
    ),
    icon: <StatusDot status={hasDocIssues ? 'fail' : 'pass'} />,
    disabled: !hasDocIssues,
    onSelect: () => setDocsExpanded((prev) => !prev),
  };

  const menuItems: MenuEntry[] = [
    ...checkItems,
    docsItem,
    { id: 'run-all-separator', type: 'separator' },
    {
      id: 'run-all',
      label: 'Run all',
      disabled: anyRunning,
      onSelect: runAllChecks,
    },
  ];

  const fixButton = failingCheck?.fixCmd ? (
    <FixButton
      label={fixing ? 'Fixing…' : 'Auto-fix'}
      tooltip={
        fixing ? 'Running the fix command…' : `Run \`${failingCheck.fixCmd}\`, then re-check.`
      }
      variant={CHECK_VARIANT[failingCheck.status]}
      disabled={fixing || fixState !== null}
      onClick={() => runAutoFix(failingCheck.name)}
    />
  ) : failing ? (
    <FixButton
      label={fixState === 'own' ? 'Fixing…' : 'Fix'}
      tooltip={
        fixState === 'own'
          ? 'An agent is fixing this check.'
          : fixState === 'other'
            ? 'Another fix is in flight — wait for it to finish.'
            : `Send an agent to fix the ${failing.sourceKey} check.`
      }
      variant="error"
      disabled={fixState !== null || fixing}
      onClick={fixCheck}
    />
  ) : null;

  return (
    <div
      className={
        pinned
          ? 'sticky bottom-0 z-10 flex flex-col gap-2 border-t border-black/10 px-4 py-2'
          : 'flex flex-col gap-2'
      }
      style={pinned ? getSurfaceStyles(surface.page) : undefined}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Menu
          trigger={
            <Stamp size="small" variant={statusVariant}>
              {statusLabel}
            </Stamp>
          }
          items={menuItems}
          className="[&_[role=menuitem]]:px-2 [&_[role=menuitem]]:py-1 [&_[role=menuitem]]:text-sm"
        />
        {fixButton}
        <span className="text-xs opacity-60">
          {gitStateLine(hasChanges, files.length, gitAhead, branch)}
        </span>
        <div className="flex-1" />
        {gitAhead > 0 && (
          <Button
            size="small"
            icon={<PushIcon size={14} />}
            disabled={gitActionBusy}
            onClick={handlePush}
          >
            {pushing ? 'Pushing…' : `Push ${gitAhead}`}
          </Button>
        )}
        <IconButton
          icon={<PullIcon size={14} />}
          variant="ghost"
          size="small"
          label={pulling ? 'Pulling…' : 'Pull'}
          disabled={gitActionBusy}
          onClick={handlePull}
        />
      </div>
      {docsExpanded && hasDocIssues && (
        <div id="deliver-doc-findings" className="flex flex-col gap-2">
          {consistency.map((issue, i) => {
            const linkedPlan = linkedPlanFor(issue);
            return (
              <div
                key={`${issue.kind}-${issue.title}-${i}`}
                className="font-mono text-2xs opacity-70"
              >
                {linkedPlan ? (
                  <Button
                    variant="link"
                    onClick={() => navigate(entityLink(linkedPlan))}
                    className="text-inherit"
                  >
                    {issue.message}
                  </Button>
                ) : (
                  <span className="text-left">{issue.message}</span>
                )}
              </div>
            );
          })}
        </div>
      )}
      {hasChanges && (
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <CommitMessageFields state={commitForm} filesEmpty={false} />
          </div>
          {commitButton}
        </div>
      )}
    </div>
  );
};
