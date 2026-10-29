import { DeliverBar, GitLocalStateDriftSurface, GitStashSurface } from '@/app/components';
import { GitCommitButton } from '@/app/features/git/actions';
import { useGitPage } from '@/app/features/git/hooks';
import { CommitHistory, FileDiffSection } from '@/app/features/git/views';
import { Button, Divider, PageTitle, Spinner } from '@dendelion/folk-ui';
import { Fragment } from 'react';

export const GitPage = () => {
  const {
    files,
    loadFailed,
    loadDiffFiles,
    sectionsRef,
    commitForm,
    gitLogCommits,
    gitLogUpstream,
    gitLogHasMore,
    gitLogLoadingMore,
    gitLogLoadFailed,
    gitLogLoadMoreFailed,
    loadGitLog,
    loadMoreGitLog,
    gitBranch,
    gitAhead,
  } = useGitPage();

  const contentClass = 'min-h-page';
  const hasChanges = (files?.length ?? 0) > 0;

  const header = (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <PageTitle className="!mb-0">Git</PageTitle>
      <div className="flex items-center gap-2">
        <GitLocalStateDriftSurface />
        <GitStashSurface />
      </div>
    </div>
  );

  const footer = (
    <DeliverBar
      pinned
      files={files?.map((entry) => ({ path: entry.path, staged: entry.staged })) ?? []}
      gitAhead={gitAhead}
      branch={gitBranch ?? undefined}
      commitForm={commitForm}
      commitButton={<GitCommitButton state={commitForm} filesEmpty={false} />}
    />
  );

  if (loadFailed) {
    return (
      <div>
        {header}
        <div className={`${contentClass} flex flex-col items-start gap-3 pb-10`}>
          <p className="opacity-50 m-0">Couldn't load the working-tree diff.</p>
          <Button variant="secondary" size="small" onClick={loadDiffFiles}>
            Retry
          </Button>
        </div>
        {footer}
      </div>
    );
  }

  if (!files) {
    return (
      <div>
        {header}
        <div className={`${contentClass} pb-10`}>
          <Spinner label="Loading the working-tree diff…" />
        </div>
        {footer}
      </div>
    );
  }

  return (
    <div>
      {header}
      <div className={`${contentClass} flex flex-col gap-6 ${hasChanges ? 'pb-20' : 'pb-10'}`}>
        {files.length === 0 ? (
          <div className="flex flex-col gap-3">
            {gitLogLoadFailed ? (
              <div className="flex flex-col items-start gap-3">
                <p className="opacity-50 m-0">Couldn't load the commit history.</p>
                <Button variant="secondary" size="small" onClick={loadGitLog}>
                  Retry
                </Button>
              </div>
            ) : gitLogCommits === null ? (
              <Spinner label="Loading commit history…" />
            ) : (
              <>
                <CommitHistory commits={gitLogCommits} upstream={gitLogUpstream} />
                {gitLogHasMore && (
                  <div className="flex items-center gap-3">
                    <Button
                      className="self-start"
                      variant="secondary"
                      size="small"
                      onClick={loadMoreGitLog}
                      disabled={gitLogLoadingMore}
                    >
                      {gitLogLoadingMore ? 'Loading…' : 'Show older'}
                    </Button>
                    {gitLogLoadMoreFailed && (
                      <span className="opacity-50 text-2xs">Couldn't load older commits.</span>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          <div ref={sectionsRef} className="flex min-w-0 flex-col gap-6">
            {files.map((entry, idx) => (
              <Fragment key={entry.path}>
                {idx > 0 && <Divider />}
                <FileDiffSection entry={entry} />
              </Fragment>
            ))}
          </div>
        )}
      </div>
      {footer}
    </div>
  );
};
