import { useGitCommitForm } from '@/app/features/git/hooks/use-git-commit-form';
import { subscribeToActivityStream } from '@/app/services/activity-stream';
import { useAppStore } from '@/app/stores/app-store';
import { useEffect, useMemo, useRef } from 'react';

export const useGitPage = () => {
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

  return {
    files,
    loadFailed,
    loadDiffFiles,
    sectionsRef,
    commitForm,
  };
};

export type GitPageState = ReturnType<typeof useGitPage>;
