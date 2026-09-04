import { EmptyState } from '@/app/components';
import { PageTitle } from '@/app/components/page-title';
import { useResolvedDocSection } from '@/app/hooks';
import { useAppStore } from '@/app/stores/app-store';
import { DocsSearch } from './components/docs-search';
import { ReleaseNotesDetail } from './components/release-notes-detail';
import { RepoDocDetail } from './components/repo-doc-detail';

export const DocsPage = () => {
  const docSearchQuery = useAppStore((s) => s.docSearchQuery);
  const activeDocTitle = useAppStore((s) => s.activeDocTitle);
  const activeReleaseVersion = useAppStore((s) => s.activeReleaseVersion);
  const activeDocSection = useResolvedDocSection();

  if (docSearchQuery.trim()) {
    return (
      <div>
        <DocsSearch query={docSearchQuery} />
      </div>
    );
  }

  if (activeDocSection === 'repo-docs' && activeDocTitle) {
    return (
      <div>
        <RepoDocDetail />
      </div>
    );
  }

  if (activeDocSection === 'release-notes' && activeReleaseVersion) {
    return (
      <div>
        <ReleaseNotesDetail />
      </div>
    );
  }

  return (
    <div>
      <PageTitle>Docs</PageTitle>
      <EmptyState message="Pick a doc from the sidebar — start with a repo doc if you're new here." />
    </div>
  );
};
