import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useReleaseNotes } from '@/app/features/docs/hooks/use-release-notes';
import { DocMarkdown } from '../docs/doc-markdown';
import { DocSheet } from '../docs/doc-sheet';
import styles from '../docs/docs.module.css';
import { useDocsScreen } from '../hooks/use-docs-screen';
import { BackHeader } from '../shell/back-header';
import { RELEASES_PAGE_SIZE, releaseMarkdown } from '../shell/docs-model';
import { SCREEN_PATHS } from '../shell/screens';
import { Button } from '../ui/button';
import { EmptyState } from '../ui/empty-state';
import { Hand } from '../ui/hand';
import { SkeletonRows } from '../ui/skeleton-rows';

function ReleaseSheet({ version }: { version: string }) {
  const notes = useReleaseNotes(version);
  return (
    <DocSheet title={version}>
      {notes.status === 'loading' ? <SkeletonRows count={2} /> : null}
      {notes.status === 'missing' || (notes.status === 'ready' && notes.sections.length === 0) ? (
        <Hand size="sm" color="inkSoft">
          No release notes recorded for {version}.
        </Hand>
      ) : null}
      {notes.status === 'ready' && notes.sections.length > 0 ? (
        <DocMarkdown>{releaseMarkdown(notes.sections)}</DocMarkdown>
      ) : null}
    </DocSheet>
  );
}

export const ReleasesPage = () => {
  const screen = useDocsScreen();
  const navigate = useNavigate();
  const [shown, setShown] = useState(RELEASES_PAGE_SIZE);
  const versions = screen.releaseVersions;

  return (
    <div className={styles.page}>
      <BackHeader onBack={() => void navigate({ to: SCREEN_PATHS.docs })} label="Docs" />
      <div className={styles.content}>
        {versions.length === 0 && screen.releasesLoading ? <SkeletonRows /> : null}
        {versions.length === 0 && !screen.releasesLoading ? (
          <EmptyState title="No releases yet" line="Published versions will be listed here." />
        ) : null}
        {versions.slice(0, shown).map((version) => (
          <ReleaseSheet key={version} version={version} />
        ))}
        {versions.length > shown ? (
          <div className={styles.centered}>
            <Button
              label={`Show older releases (${versions.length - shown})`}
              variant="secondary"
              size="sm"
              onPress={() => setShown((count) => count + RELEASES_PAGE_SIZE)}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
};
