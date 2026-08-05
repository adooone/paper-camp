import { PageTitle } from '@/app/components/page-title';
import { useResolvedDocSection } from '@/app/hooks';
import { useAppStore } from '@/app/stores/app-store';
import { Breadcrumb } from '@dendelion/paper-ui';
import { useNavigate } from '@tanstack/react-router';
import { DocsSearch } from './components/docs-search';
import { ReleaseNotesDetail } from './components/release-notes-detail';
import { RepoDocDetail } from './components/repo-doc-detail';

export const DocsPage = () => {
  const docSearchQuery = useAppStore((s) => s.docSearchQuery);
  const activeDocTitle = useAppStore((s) => s.activeDocTitle);
  const activeReleaseVersion = useAppStore((s) => s.activeReleaseVersion);
  const navigate = useNavigate();
  const activeDocSection = useResolvedDocSection();

  const handleBackToDocs = () => navigate({ to: '/docs' });

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
        <div className="mb-4">
          <Breadcrumb
            items={[
              { id: 'docs', label: 'Docs', onClick: handleBackToDocs },
              { id: 'repo-doc', label: activeDocTitle },
            ]}
          />
        </div>
        <RepoDocDetail />
      </div>
    );
  }

  if (activeDocSection === 'release-notes' && activeReleaseVersion) {
    return (
      <div>
        <div className="mb-4">
          <Breadcrumb
            items={[
              { id: 'docs', label: 'Docs', onClick: handleBackToDocs },
              { id: 'release-notes', label: activeReleaseVersion },
            ]}
          />
        </div>
        <ReleaseNotesDetail />
      </div>
    );
  }

  return (
    <div>
      <PageTitle>Docs</PageTitle>
      <p className="opacity-50">
        Pick a doc from the sidebar — start with a repo doc if you're new here.
      </p>
    </div>
  );
};
