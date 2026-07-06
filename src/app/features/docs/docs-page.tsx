import { PageTitle } from '@/app/components/page-title';
import { useActiveDocSection } from '@/app/hooks';
import { useAppStore } from '@/app/stores/app-store';
import { DecisionDetail } from './components/decision-detail';
import { DocsSearch } from './components/docs-search';
import { OpenQuestionDetail } from './components/open-question-detail';
import { ProgressTimeline } from './components/progress-timeline';
import { RepoDocDetail } from './components/repo-doc-detail';

export const DocsPage = () => {
  const docSearchQuery = useAppStore((s) => s.docSearchQuery);
  const routeSection = useActiveDocSection();
  const activeDocTitle = useAppStore((s) => s.activeDocTitle);
  const repoDocs = useAppStore((s) => s.repoDocs);
  // Bare /docs (no route section) falls back to the pre-selected repo doc — currently
  // just MAIN.md (see loadRepoDocs) — until IDEA-40's later phase gives /docs itself
  // a default route.
  const activeDocSection =
    routeSection ??
    (activeDocTitle && repoDocs.some((f) => f.name === activeDocTitle) ? 'repo-docs' : null);

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
