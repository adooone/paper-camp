import { PageTitle } from '@/app/components/page-title';
import { useResolvedDocSection } from '@/app/hooks';
import { useAppStore } from '@/app/stores/app-store';
import { space } from '@/app/styles/tokens';
import { Breadcrumb } from '@dendelion/paper-ui';
import { useNavigate } from '@tanstack/react-router';
import { DecisionDetail } from './components/decision-detail';
import { DocsSearch } from './components/docs-search';
import { OpenQuestionDetail } from './components/open-question-detail';
import { ProgressTimeline } from './components/progress-timeline';
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

  if (activeDocSection === 'decisions' && activeDocTitle) {
    return (
      <div>
        <div style={{ marginBottom: space[4] }}>
          <Breadcrumb
            items={[
              { id: 'docs', label: 'Docs', onClick: handleBackToDocs },
              { id: 'decision', label: activeDocTitle },
            ]}
          />
        </div>
        <PageTitle>Decisions</PageTitle>
        <DecisionDetail />
      </div>
    );
  }

  if (activeDocSection === 'questions' && activeDocTitle) {
    return (
      <div>
        <div style={{ marginBottom: space[4] }}>
          <Breadcrumb
            items={[
              { id: 'docs', label: 'Docs', onClick: handleBackToDocs },
              { id: 'question', label: activeDocTitle },
            ]}
          />
        </div>
        <PageTitle>Open Questions</PageTitle>
        <OpenQuestionDetail />
      </div>
    );
  }

  if (activeDocSection === 'progress') {
    return (
      <div>
        <div style={{ marginBottom: space[4] }}>
          <Breadcrumb
            items={[
              { id: 'docs', label: 'Docs', onClick: handleBackToDocs },
              { id: 'progress', label: activeDocTitle ?? 'Progress' },
            ]}
          />
        </div>
        <PageTitle>Progress</PageTitle>
        <ProgressTimeline />
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
      <p style={{ opacity: 0.5 }}>Select a section from the sidebar.</p>
    </div>
  );
};
