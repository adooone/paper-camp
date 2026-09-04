import { useCiRelease } from '@/app/hooks/use-ci-release';
import { useAppStore } from '@/app/stores/app-store';
import type { CiRun, CiRunStatus } from '@/types/index';
import { Card } from '@dendelion/paper-ui';
import { useEffect, useRef } from 'react';
import { EmptyState } from '../empty-state';
import { groupLabelClassName } from './shared';

export const CI_GROUP_LABEL = 'CI & release';

const runDotClass: Record<CiRunStatus, string> = {
  success: 'bg-chalk-pass-text',
  failure: 'bg-chalk-fail-text',
  in_progress: 'bg-chalk-running-text',
  queued: 'bg-chalk-running-text',
  cancelled: 'bg-desk-text-muted',
  unknown: 'bg-desk-text-muted',
};

const linkClass = 'text-desk-chalk underline decoration-desk-border hover:decoration-desk-chalk';

const RunRow = ({ run }: { run: CiRun }) => {
  const label = (
    <span className="flex min-w-0 items-center gap-2">
      <span
        aria-hidden="true"
        className={`h-2 w-2 shrink-0 rounded-full ${runDotClass[run.status]}`}
      />
      <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-desk-chalk">
        {run.workflow}
      </span>
      <span className="shrink-0 font-mono text-2xs text-desk-text-muted">{run.status}</span>
    </span>
  );
  return run.url ? (
    <a href={run.url} target="_blank" rel="noreferrer" className="no-underline">
      {label}
    </a>
  ) : (
    label
  );
};

export const CiGroup = () => {
  const { ci, loading, refresh } = useCiRelease();
  const refreshing = useAppStore((s) => s.refreshing);
  const wasRefreshing = useRef(false);

  useEffect(() => {
    if (wasRefreshing.current && !refreshing) refresh();
    wasRefreshing.current = refreshing;
  }, [refreshing, refresh]);

  const body = () => {
    if (!ci) {
      return (
        <Card surface="chalkboard" size="small">
          {loading ? (
            <p className="m-0 text-center text-xs opacity-50">Checking CI…</p>
          ) : (
            <EmptyState message="No CI source declared." />
          )}
        </Card>
      );
    }
    const actionsUrl = `https://github.com/${ci.repo}/actions`;
    if (!ci.available) {
      return (
        <Card surface="chalkboard" size="small">
          <p className="m-0 text-center text-xs opacity-70">
            CI status unavailable —{' '}
            <a href={actionsUrl} target="_blank" rel="noreferrer" className={linkClass}>
              open Actions
            </a>
          </p>
        </Card>
      );
    }
    return (
      <Card surface="chalkboard" size="small">
        <div className="flex flex-col gap-2 text-sm">
          {ci.runs.length > 0 ? (
            ci.runs.map((run) => <RunRow key={run.workflow} run={run} />)
          ) : (
            <span className="text-xs text-desk-text-muted opacity-70">
              No recent runs on {ci.branch}.
            </span>
          )}
          <div className="font-mono text-2xs text-desk-text-muted">
            Released {ci.releasedVersion ?? '—'} · Queued {ci.releasePr?.version ?? 'none'}
          </div>
          <div className="flex flex-wrap gap-x-3 text-2xs">
            {ci.releasePr && (
              <a href={ci.releasePr.url} target="_blank" rel="noreferrer" className={linkClass}>
                Release PR <span className="font-mono">#{ci.releasePr.number}</span>
              </a>
            )}
            <a href={actionsUrl} target="_blank" rel="noreferrer" className={linkClass}>
              Open Actions
            </a>
          </div>
        </div>
      </Card>
    );
  };

  return (
    <div>
      <h4 className={`${groupLabelClassName} m-0`}>{CI_GROUP_LABEL}</h4>
      {body()}
    </div>
  );
};
