import { CommitMessageFields, EmptyState, GitStashSurface, GitSyncActions } from '@/app/components';
import { CleanSheetIllustration } from '@/app/components/empty-state-illustrations';
import { PageTitle } from '@/app/components/page-title';
import { GitCommitButton } from '@/app/features/git/actions';
import { useGitPage } from '@/app/features/git/hooks';
import { FileDiffSection } from '@/app/features/git/views';
import { Button, Divider, Spinner } from '@dendelion/paper-ui';
import { Fragment } from 'react';

export const GitPage = () => {
  const { files, loadFailed, loadDiffFiles, sectionsRef, commitForm } = useGitPage();

  const contentClass = 'min-h-page';

  const header = (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <PageTitle className="!mb-0">Git</PageTitle>
      <div className="flex items-center gap-2">
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
          <EmptyState illustration={<CleanSheetIllustration />} message="No changed files." />
        </div>
      ) : (
        <>
          <div className="sticky top-0 z-10 mb-4 flex items-center gap-2 py-2">
            <div className="flex-1">
              <CommitMessageFields state={commitForm} filesEmpty={false} />
            </div>
            <GitCommitButton state={commitForm} filesEmpty={false} />
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
