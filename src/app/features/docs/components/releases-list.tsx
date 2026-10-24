import { Markdown } from '@/app/components/markdown';
import { useAppStore } from '@/app/stores/app-store';
import { Button, Divider, EmptyState, PageTitle, Skeleton, Text } from '@dendelion/folk-ui';
import { useEffect, useState } from 'react';
import { useReleaseNotes } from '../hooks/use-release-notes';

// Each release is its own request, so the page grows on demand instead of fetching all at once.
const PAGE_SIZE = 10;

const ReleaseBlock = ({ version }: { version: string }) => {
  const notes = useReleaseNotes(version);
  return (
    <section className="flex flex-col gap-3" aria-label={version}>
      <Text as="h2" face="display" weight="semibold" className="m-0 text-[1.5rem] leading-[1.2]">
        {version}
      </Text>
      {notes.status === 'loading' ? (
        <div className="flex flex-col gap-2" aria-hidden="true">
          <Skeleton variant="text" width="55%" />
          <Skeleton variant="text" width="40%" />
        </div>
      ) : notes.status === 'missing' || notes.sections.length === 0 ? (
        <p className="m-0 opacity-50">No release notes recorded for {version}.</p>
      ) : (
        <div className="text-base leading-[1.7] text-ink-900">
          <Markdown>
            {notes.sections
              .map(
                (section) =>
                  `### ${section.label}\n\n${section.ideas
                    .map((idea) =>
                      idea.id ? `- **${idea.title}** (${idea.id})` : `- ${idea.title}`,
                    )
                    .join('\n')}`,
              )
              .join('\n\n')}
          </Markdown>
        </div>
      )}
    </section>
  );
};

/** Every release on one scrolling page, newest first, the way GitHub lists them. */
export const ReleasesList = () => {
  const versions = useAppStore((s) => s.releaseVersions);
  const loading = useAppStore((s) => s.releaseVersionsLoading);
  const loadReleaseVersions = useAppStore((s) => s.loadReleaseVersions);
  const [shown, setShown] = useState(PAGE_SIZE);

  useEffect(() => {
    loadReleaseVersions();
  }, [loadReleaseVersions]);

  return (
    <div className="flex flex-col gap-6">
      <PageTitle>Releases</PageTitle>
      {loading && versions.length === 0 ? (
        <Skeleton variant="text" width="30%" />
      ) : versions.length === 0 ? (
        <EmptyState message="No releases yet." />
      ) : (
        <>
          {versions.slice(0, shown).map((version, index) => (
            <div key={version} className="flex flex-col gap-6">
              {index > 0 && <Divider sketch />}
              <ReleaseBlock version={version} />
            </div>
          ))}
          {versions.length > shown && (
            <div className="flex justify-center">
              <Button
                variant="secondary"
                size="small"
                onClick={() => setShown((n) => n + PAGE_SIZE)}
              >
                Show older releases ({versions.length - shown})
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
};
