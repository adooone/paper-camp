import { CommitMessageFields, GitStashSurface, GitSyncActions } from '@/app/components';
import { PageTitle } from '@/app/components/page-title';
import { FileDiffSection } from '@/app/features/git/file-diff-section';
import { GitCommitButton, useGitCommitForm } from '@/app/features/git/git-commit-controls';
import { subscribeToActivityStream } from '@/app/services/activity-stream';
import { useAppStore } from '@/app/stores/app-store';
import { Button, Divider, Spinner } from '@dendelion/paper-ui';
import { Fragment, useEffect, useMemo, useRef } from 'react';

export const GitPage = () => {
  const files = useAppStore((s) => s.diffFiles);
  const loadFailed = useAppStore((s) => s.diffLoadFailed);
  const loadDiffFiles = useAppStore((s) => s.loadDiffFiles);
  const setActiveDiffPath = useAppStore((s) => s.setActiveDiffPath);
  const sectionsRef = useRef<HTMLDivElement>(null);
  const commitFiles = useMemo(
    () => files?.map((entry) => ({ path: entry.path, staged: entry.staged })) ?? [],
    [files],
  );
  const commitForm = useGitCommitForm(commitFiles);

  useEffect(() => {
    loadDiffFiles();
  }, [loadDiffFiles]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = subscribeToActivityStream((payload) => {
      if (payload.message !== 'changed') return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(loadDiffFiles, 250);
    });
    const onFocus = () => loadDiffFiles();
    window.addEventListener('focus', onFocus);
    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener('focus', onFocus);
      unsubscribe();
    };
  }, [loadDiffFiles]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: files is the trigger to rebuild the observer, not a value read in the body.
  useEffect(() => {
    const root = sectionsRef.current;
    if (!root) return;
    const sections = Array.from(root.querySelectorAll<HTMLElement>('[data-diff-path]'));
    if (sections.length === 0) return;
    const visible = new Set<HTMLElement>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target as HTMLElement);
          else visible.delete(entry.target as HTMLElement);
        }
        const topmost = sections.find((el) => visible.has(el));
        if (topmost) setActiveDiffPath(topmost.dataset.diffPath ?? null);
      },
      { rootMargin: '0px 0px -70% 0px' },
    );
    for (const el of sections) observer.observe(el);
    return () => observer.disconnect();
  }, [files, setActiveDiffPath]);

  const contentClass = 'min-h-page';

  // Title and repo actions share a row: stacked, they cost three bands of vertical
  // space before any diff shows.
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
          <p className="opacity-50">No changed files.</p>
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
