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

/** Docs / <item> breadcrumb above a doc detail view — the "Docs" crumb navigates back. */
const DocsBreadcrumb = ({
  itemId,
  label,
  onBack,
}: {
  itemId: string;
  label: string;
  onBack: () => void;
}) => (
  <div style={{ marginBottom: space[4] }}>
    <Breadcrumb
      items={[
        { id: 'docs', label: 'Docs', onClick: onBack },
        { id: itemId, label },
      ]}
    />
  </div>
);

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
        <DocsBreadcrumb itemId="decision" label={activeDocTitle} onBack={handleBackToDocs} />
        <PageTitle>Decisions</PageTitle>
        <DecisionDetail />
      </div>
    );
  }

  if (activeDocSection === 'questions' && activeDocTitle) {
    return (
      <div>
        <DocsBreadcrumb itemId="question" label={activeDocTitle} onBack={handleBackToDocs} />
        <PageTitle>Open Questions</PageTitle>
        <OpenQuestionDetail />
      </div>
    );
  }

  if (activeDocSection === 'progress') {
    return (
      <div>
        <DocsBreadcrumb
          itemId="progress"
          label={activeDocTitle ?? 'Progress'}
          onBack={handleBackToDocs}
        />
        <PageTitle>Progress</PageTitle>
        <ProgressTimeline />
      </div>
    );
  }

  if (activeDocSection === 'repo-docs' && activeDocTitle) {
    return (
      <div>
        <DocsBreadcrumb itemId="repo-doc" label={activeDocTitle} onBack={handleBackToDocs} />
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
