import { useCiRelease } from '@/app/hooks/use-ci-release';
import { ciRunWord } from '@/core/ci/ci-run-word';
import type { CiReleaseState, CiRun, CiRunStatus, DraftPrReadiness } from '@/types/index';
import { Card, EmptyState, IconButton, RefreshIcon, Skeleton, Spinner } from '@dendelion/folk-ui';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { formatLastRun, groupLabelClassName } from './shared';

export const CI_GROUP_LABEL = 'CI & release';

const runDotClass: Record<CiRunStatus, string> = {
  success: 'bg-chalk-pass-text',
  failure: 'bg-chalk-fail-text',
  in_progress: 'bg-chalk-running-text',
  queued: 'bg-chalk-running-text',
  cancelled: 'bg-desk-text-muted',
  unknown: 'bg-desk-text-muted',
};

const Row = ({
  dotStatus,
  name,
  word,
  wordClassName = 'text-desk-text-muted',
  tooltip,
  href,
  onClick,
}: {
  dotStatus: CiRunStatus;
  name: string;
  word: string;
  wordClassName?: string;
  tooltip?: string;
  href?: string | null;
  onClick?: () => void;
}) => {
  const label = (
    <span className="flex min-w-0 items-center gap-2" title={tooltip}>
      <span
        aria-hidden="true"
        className={`h-2 w-2 shrink-0 rounded-full ${runDotClass[dotStatus]}`}
      />
      <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-desk-chalk">
        {name}
      </span>
      <span className={`shrink-0 font-mono text-2xs ${wordClassName}`}>{word}</span>
    </span>
  );
  if (onClick) {
    return (
      // Raw button: folk-ui has no full-width clickable row primitive.
      <button
        type="button"
        onClick={onClick}
        className="flex w-full cursor-pointer border-0 bg-transparent p-0 text-left"
      >
        {label}
      </button>
    );
  }
  return href ? (
    <a href={href} target="_blank" rel="noreferrer" className="no-underline">
      {label}
    </a>
  ) : (
    label
  );
};

const RunRow = ({ run }: { run: CiRun }) => (
  <Row
    dotStatus={run.status}
    name={run.workflow}
    word={ciRunWord(run.status)}
    tooltip={run.failedJobs?.join(', ')}
    href={run.url}
  />
);

export const draftPrSecretsMissing = (draftPr: DraftPrReadiness): boolean =>
  draftPr.secretsChecked && (!draftPr.scoutAppId || !draftPr.scoutPrivateKey);

const DraftPrRow = ({ draftPr }: { draftPr: DraftPrReadiness }) => {
  const navigate = useNavigate();
  if (draftPrSecretsMissing(draftPr)) {
    return (
      <Row
        dotStatus="failure"
        name={draftPr.lastRun?.workflow ?? 'Draft PR'}
        word="secrets missing"
        wordClassName="text-chalk-fail-text"
        onClick={() => navigate({ to: '/project/settings/$section', params: { section: 'desk' } })}
      />
    );
  }
  return draftPr.lastRun ? <RunRow run={draftPr.lastRun} /> : null;
};

export const versionLine = (ci: CiReleaseState): string => {
  const released = ci.releasedVersion ?? '—';
  if (!ci.releasePlease) return released;
  return `${released} · ${ci.releasePr ? `${ci.releasePr.version} queued` : 'nothing queued'}`;
};

const VersionLine = ({ ci }: { ci: CiReleaseState }) => {
  const text = <span className="font-mono text-2xs text-desk-text-muted">{versionLine(ci)}</span>;
  return ci.releasePr ? (
    <a href={ci.releasePr.url} target="_blank" rel="noreferrer" className="no-underline">
      {text}
    </a>
  ) : (
    text
  );
};

const CiGroupSkeleton = () => (
  <Card surface="chalkboard" size="small">
    <div className="flex flex-col gap-2" aria-hidden="true">
      <Skeleton variant="rect" width="100%" height={20} surface="chalkboard" />
      <Skeleton variant="rect" width="100%" height={20} surface="chalkboard" />
      <Skeleton variant="rect" width="100%" height={20} surface="chalkboard" />
    </div>
  </Card>
);

export const CiGroup = () => {
  const { ci, loading, refresh } = useCiRelease();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  };

  const body = () => {
    if (loading) return <CiGroupSkeleton />;
    if (!ci) {
      return (
        <Card surface="chalkboard" size="small">
          <EmptyState message="No CI source declared." />
        </Card>
      );
    }
    if (!ci.available) {
      return (
        <Card surface="chalkboard" size="small">
          <p className="m-0 text-center text-xs text-desk-text-muted opacity-70">
            GitHub unavailable.
          </p>
        </Card>
      );
    }
    return (
      <Card surface="chalkboard" size="small">
        <div className="flex flex-col gap-2 text-sm">
          {ci.runs === null ? (
            <span className="text-2xs text-desk-text-muted opacity-70">couldn't read runs</span>
          ) : ci.runs.length > 0 ? (
            ci.runs.map((run) => <RunRow key={run.workflow} run={run} />)
          ) : (
            <span className="text-2xs text-desk-text-muted opacity-70">
              No recent runs on {ci.branch}.
            </span>
          )}
          {ci.draftPr && <DraftPrRow draftPr={ci.draftPr} />}
          <VersionLine ci={ci} />
        </div>
      </Card>
    );
  };

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h4 className={`${groupLabelClassName} m-0`}>{CI_GROUP_LABEL}</h4>
        {ci && (
          <div className="flex shrink-0 items-center gap-1">
            <span className="font-handwritten text-xs text-desk-text-muted">
              {formatLastRun(ci.fetchedAt)}
            </span>
            {refreshing ? (
              <Spinner size="small" surface="chalkboard" label="Refreshing CI" />
            ) : (
              <IconButton
                icon={<RefreshIcon size={14} />}
                label="Refresh CI"
                size="tiny"
                surface="chalkboard"
                variant="ghost"
                onClick={handleRefresh}
              />
            )}
          </div>
        )}
      </div>
      {body()}
    </div>
  );
};
