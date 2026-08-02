import { fetchFileDiffs } from '@/app/services/git-api';
import type { FileDiffEntry } from '@/types/index';
import { Breadcrumb } from '@dendelion/paper-ui';
import { useNavigate } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { FileDiffSection } from './file-diff-card';
import { FileListSidebar } from './file-list-sidebar';

export const DiffPage = () => {
  const navigate = useNavigate();
  const [files, setFiles] = useState<FileDiffEntry[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const sectionRefs = useRef(new Map<string, HTMLDivElement>());

  useEffect(() => {
    fetchFileDiffs()
      .then(setFiles)
      .catch(() => setLoadFailed(true));
  }, []);

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

  const contentClass = 'min-h-[calc(100vh-64px)]';

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

  const scrollToFile = (path: string) => {
    sectionRefs.current.get(path)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div>
      {breadcrumb}
      {files.length === 0 ? (
        <div className={contentClass}>
          <p className="opacity-50">No changed files.</p>
        </div>
      ) : (
        <div className={`flex items-start gap-6 ${contentClass}`}>
          <FileListSidebar files={files} onSelect={scrollToFile} />
          <div className="flex min-w-0 flex-1 flex-col gap-6">
            {files.map((entry) => (
              <FileDiffSection
                key={entry.path}
                entry={entry}
                sectionRef={(el) => {
                  if (el) sectionRefs.current.set(entry.path, el);
                  else sectionRefs.current.delete(entry.path);
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
