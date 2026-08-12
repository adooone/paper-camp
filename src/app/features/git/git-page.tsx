import { apiUrl } from '@/app/services/api-base';
import { useAppStore } from '@/app/stores/app-store';
import { Breadcrumb, Divider } from '@dendelion/paper-ui';
import { useNavigate } from '@tanstack/react-router';
import { Fragment, useEffect, useRef } from 'react';
import { FileDiffSection } from './file-diff-section';

export const GitPage = () => {
  const navigate = useNavigate();
  const files = useAppStore((s) => s.diffFiles);
  const loadFailed = useAppStore((s) => s.diffLoadFailed);
  const loadDiffFiles = useAppStore((s) => s.loadDiffFiles);
  const setActiveDiffPath = useAppStore((s) => s.setActiveDiffPath);
  const sectionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadDiffFiles();
  }, [loadDiffFiles]);

  useEffect(() => {
    const source = new EventSource(apiUrl('/api/activity/stream'));
    let timer: ReturnType<typeof setTimeout> | undefined;
    source.onmessage = (event) => {
      let payload: { message?: string };
      try {
        payload = JSON.parse(event.data);
      } catch {
        return;
      }
      if (payload.message !== 'changed') return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(loadDiffFiles, 250);
    };
    const onFocus = () => loadDiffFiles();
    window.addEventListener('focus', onFocus);
    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener('focus', onFocus);
      source.close();
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

  const breadcrumb = (
    <div className="mb-4">
      <Breadcrumb
        items={[
          { id: 'plans', label: 'Plans', onClick: () => navigate({ to: '/' }) },
          { id: 'git', label: 'Git' },
        ]}
      />
    </div>
  );

  const contentClass = 'min-h-page';

  if (loadFailed) {
    return (
      <div>
        {breadcrumb}
        <div className={contentClass}>
          <p className="opacity-50">Couldn't load the working-tree diff.</p>
        </div>
      </div>
    );
  }

  if (!files) {
    return (
      <div>
        {breadcrumb}
        <div className={contentClass}>
          <p className="opacity-50">Loading…</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {breadcrumb}
      {files.length === 0 ? (
        <div className={contentClass}>
          <p className="opacity-50">No changed files.</p>
        </div>
      ) : (
        <div ref={sectionsRef} className={`flex min-w-0 flex-col gap-6 ${contentClass}`}>
          {files.map((entry, idx) => (
            <Fragment key={entry.path}>
              {idx > 0 && <Divider />}
              <FileDiffSection entry={entry} />
            </Fragment>
          ))}
        </div>
      )}
    </div>
  );
};
