import { fetchFileDiffs } from '@/app/services/git-api';
import { space } from '@/app/styles/tokens';
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
    <div style={{ marginBottom: space[4] }}>
      <Breadcrumb
        items={[
          { id: 'plans', label: 'Plans', onClick: () => navigate({ to: '/' }) },
          { id: 'changes', label: 'Changes' },
        ]}
      />
    </div>
  );

  if (loadFailed) {
    return (
      <div>
        {breadcrumb}
        <p style={{ opacity: 0.5 }}>Couldn't load the working-tree diff.</p>
      </div>
    );
  }

  if (!files) {
    return (
      <div>
        {breadcrumb}
        <p style={{ opacity: 0.5 }}>Loading…</p>
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
        <p style={{ opacity: 0.5 }}>No changed files.</p>
      ) : (
        <div style={{ display: 'flex', gap: space[6], alignItems: 'flex-start' }}>
          <FileListSidebar files={files} onSelect={scrollToFile} />
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: space[6],
              flex: 1,
              minWidth: 0,
            }}
          >
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
