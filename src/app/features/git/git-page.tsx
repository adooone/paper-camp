import { CommitMessageFields, GitStashSurface, GitSyncActions } from '@/app/components';
import { PageTitle } from '@/app/components/page-title';
import { GitCommitButton } from '@/app/features/git/actions';
import { useGitPage } from '@/app/features/git/hooks';
import { CommitHistory, FileDiffSection } from '@/app/features/git/views';
import { DeliverChecksRow } from '@/app/features/plans/components';
import { surface } from '@/app/styles/tokens';
import { Button, Divider, Spinner, getSurfaceStyles } from '@dendelion/paper-ui';
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
    gitBranch,
    gitAhead,
  } = useGitPage();

  const contentClass = 'min-h-page';

  const header = (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <PageTitle className="!mb-0">Git</PageTitle>
      <div className="flex items-center gap-3">
        {gitBranch && (
          <span className="font-handwritten text-2xs opacity-60">
            <span className="font-mono">{gitBranch}</span>
            {gitAhead > 0 && ` · ${gitAhead} ahead of origin`}
          </span>
        )}
        <GitSyncActions />
        <GitStashSurface />
      </div>
    </div>
  );

  if (loadFailed) {
    return (
      <div>
        {header}
        <div className={`${contentClass} flex flex-col items-start gap-3`}>
          <p className="opacity-50 m-0">Couldn't load the working-tree diff.</p>
          <Button variant="secondary" size="small" onClick={loadDiffFiles}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (!files) {
    return (
      <div>
        {header}
        <div className={contentClass}>
          <Spinner label="Loading the working-tree diff…" />
        </div>
      </div>
    );
  }

  return (
    <div>
      {header}
      {files.length === 0 ? (
        <div className={contentClass}>
          {gitLogCommits === null ? (
            <Spinner label="Loading commit history…" />
          ) : (
            <CommitHistory commits={gitLogCommits} upstream={gitLogUpstream} />
          )}
        </div>
      ) : (
        <>
          {/* Opaque: a transparent sticky bar lets the diff scroll through the commit
              field and the check stamps, which are then unreadable. */}
          <div
            className="sticky top-0 z-10 mb-4 flex flex-col gap-2 py-2"
            style={getSurfaceStyles(surface.page)}
          >
            <DeliverChecksRow showStash={false} />
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <CommitMessageFields state={commitForm} filesEmpty={false} />
              </div>
              <GitCommitButton state={commitForm} filesEmpty={false} />
            </div>
          </div>
          <div ref={sectionsRef} className={`flex min-w-0 flex-col gap-6 ${contentClass}`}>
            {files.map((entry, idx) => (
              <Fragment key={entry.path}>
                {idx > 0 && <Divider />}
                <FileDiffSection entry={entry} />
              </Fragment>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
