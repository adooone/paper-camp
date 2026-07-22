import { PageTitle } from '@/app/components/page-title';
import { useResolvedDocSection } from '@/app/hooks';
import { useAppStore } from '@/app/stores/app-store';
import { space } from '@/app/styles/tokens';
import { Breadcrumb } from '@dendelion/paper-ui';
import { useNavigate } from '@tanstack/react-router';
import { DocsSearch } from './components/docs-search';
import { RepoDocDetail } from './components/repo-doc-detail';

export const DocsPage = () => {
  const docSearchQuery = useAppStore((s) => s.docSearchQuery);
  const activeDocTitle = useAppStore((s) => s.activeDocTitle);
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
        <div style={{ marginBottom: space[4] }}>
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

  return (
    <div>
      <PageTitle>Docs</PageTitle>
      <p style={{ opacity: 0.5 }}>
        Pick a doc from the sidebar — start with a repo doc if you're new here.
      </p>
    </div>
  );
};
