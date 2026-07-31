import { fetchFileDiffs } from '@/app/services/git-api';
import { space } from '@/app/styles/tokens';
import type { FileDiffEntry } from '@/types/index';
import { Breadcrumb } from '@dendelion/paper-ui';
import { useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { FileDiffCard } from './file-diff-card';

export const DiffPage = () => {
  const navigate = useNavigate();
  const [files, setFiles] = useState<FileDiffEntry[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

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

  return (
    <div>
      {breadcrumb}
      {files.length === 0 ? (
        <p style={{ opacity: 0.5 }}>No changed files.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: space[3] }}>
          {files.map((entry) => (
            <FileDiffCard key={entry.path} entry={entry} />
          ))}
        </div>
      )}
    </div>
  );
};
