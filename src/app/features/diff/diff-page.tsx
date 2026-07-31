import { PageTitle } from '@/app/components/page-title';
import { fetchFileDiffs } from '@/app/services/git-api';
import { space } from '@/app/styles/tokens';
import type { FileDiffEntry } from '@/types/index';
import { useEffect, useState } from 'react';
import { FileDiffCard } from './file-diff-card';

export const DiffPage = () => {
  const [files, setFiles] = useState<FileDiffEntry[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    fetchFileDiffs()
      .then(setFiles)
      .catch(() => setLoadFailed(true));
  }, []);

  if (loadFailed) {
    return (
      <div>
        <PageTitle>Changes</PageTitle>
        <p style={{ opacity: 0.5 }}>Couldn't load the working-tree diff.</p>
      </div>
    );
  }

  if (!files) {
    return (
      <div>
        <PageTitle>Changes</PageTitle>
        <p style={{ opacity: 0.5 }}>Loading…</p>
      </div>
    );
  }

  return (
    <div>
      <PageTitle>Changes</PageTitle>
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
