import { useAppStore } from '@/app/stores/app-store';
import { Breadcrumb } from '@dendelion/paper-ui';
import { useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';
import { FileDiffSection } from './file-diff-card';

export const DiffPage = () => {
  const navigate = useNavigate();
  const files = useAppStore((s) => s.diffFiles);
  const loadFailed = useAppStore((s) => s.diffLoadFailed);
  const loadDiffFiles = useAppStore((s) => s.loadDiffFiles);

  useEffect(() => {
    loadDiffFiles();
  }, [loadDiffFiles]);

  const breadcrumb = (
    <div className="mb-4">
      <Breadcrumb
        items={[
          { id: 'plans', label: 'Plans', onClick: () => navigate({ to: '/' }) },
          { id: 'changes', label: 'Changes' },
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
        <div className={`flex min-w-0 flex-col gap-6 ${contentClass}`}>
          {files.map((entry) => (
            <FileDiffSection key={entry.path} entry={entry} />
          ))}
        </div>
      )}
    </div>
  );
};
