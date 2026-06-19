import { PageTitle } from '@/app/components/page-title';
import { useAppStore } from '@/app/stores/app-store';
import { DecisionDetail } from './components/decision-detail';
import { OpenQuestionDetail } from './components/open-question-detail';
import { ProgressTimeline } from './components/progress-timeline';
import { RepoDocDetail } from './components/repo-doc-detail';
import { DocsSearch } from './components/docs-search';

export const DocsPage = () => {
  const docSearchQuery = useAppStore((s) => s.docSearchQuery);
  const activeDocSection = useAppStore((s) => s.activeDocSection);
  const activeDocTitle = useAppStore((s) => s.activeDocTitle);

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
        <PageTitle>Decisions</PageTitle>
        <DecisionDetail />
      </div>
    );
  }

  if (activeDocSection === 'questions' && activeDocTitle) {
    return (
      <div>
        <PageTitle>Open Questions</PageTitle>
        <OpenQuestionDetail />
      </div>
    );
  }

  if (activeDocSection === 'progress') {
    return (
      <div>
        <PageTitle>Progress</PageTitle>
        <ProgressTimeline />
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

  return (
    <div>
      <PageTitle>Docs</PageTitle>
      <p style={{ opacity: 0.5 }}>Select a section from the sidebar.</p>
    </div>
  );
};
