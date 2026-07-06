import { useActiveDocSection } from '@/app/hooks';
import { useAppStore } from '@/app/stores/app-store';
import { space } from '@/app/styles/tokens';
import { Input, ListItem } from '@dendelion/paper-ui';
import { useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';
import { SidebarSection } from '../../plans/components/sidebar-section';

const simplecaseLabel = (name: string) =>
  name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();

const EmptyState = ({ children }: { children: React.ReactNode }) => (
  <span
    className="text-sm"
    style={{
      display: 'block',
      padding: `${space[1]} ${space[3]}`,
      opacity: 0.35,
      fontStyle: 'italic',
    }}
  >
    {children}
  </span>
);

export const DocsSidebar = () => {
  const {
    decisions,
    openQuestions,
    progress,
    repoDocs,
    decisionsLoading,
    openQuestionsLoading,
    progressLoading,
    repoDocsLoading,
    loadDecisions,
    loadOpenQuestions,
    loadProgress,
    loadRepoDocs,
    activeDocTitle,
    setActiveDocTitle,
    docSearchQuery,
    setDocSearchQuery,
  } = useAppStore();
  const routeSection = useActiveDocSection();
  const activeDocSection =
    routeSection ??
    (activeDocTitle && repoDocs.some((f) => f.name === activeDocTitle) ? 'repo-docs' : null);
  const navigate = useNavigate();

  useEffect(() => {
    loadDecisions();
    loadOpenQuestions();
    loadProgress();
    loadRepoDocs();
  }, [loadDecisions, loadOpenQuestions, loadProgress, loadRepoDocs]);

  const handleSelectDecision = (title: string) => {
    navigate({ to: '/docs/$section', params: { section: 'decisions' } });
    setActiveDocTitle(title);
  };

  return (
    <>
      <div style={{ marginBottom: space[4] }}>
        <Input
          size="small"
          aria-label="Search docs"
          placeholder="Search docs…"
          value={docSearchQuery}
          onChange={(e) => setDocSearchQuery(e.target.value)}
        />
      </div>

      <SidebarSection label="Repo Docs">
        {repoDocsLoading && repoDocs.length === 0 ? (
          <EmptyState>Loading…</EmptyState>
        ) : repoDocs.length > 0 ? (
          repoDocs.map((f) => (
            <ListItem
              key={f.name}
              size="small"
              active={activeDocSection === 'repo-docs' && activeDocTitle === f.name}
              onClick={() => {
                navigate({ to: '/docs/$section', params: { section: 'repo-docs' } });
                setActiveDocTitle(f.name);
              }}
            >
              {simplecaseLabel(f.name)}
            </ListItem>
          ))
        ) : (
          <EmptyState>No repo docs found</EmptyState>
        )}
      </SidebarSection>

      <SidebarSection label="Decisions">
        {decisionsLoading && decisions.length === 0 ? (
          <EmptyState>Loading…</EmptyState>
        ) : decisions.length > 0 ? (
          decisions.map((d) => (
            <ListItem
              key={d.title}
              size="small"
              active={activeDocSection === 'decisions' && activeDocTitle === d.title}
              onClick={() => handleSelectDecision(d.title)}
            >
              {d.title}
            </ListItem>
          ))
        ) : (
          <EmptyState>No decisions yet</EmptyState>
        )}
      </SidebarSection>

      <SidebarSection label="Open Questions">
        {openQuestionsLoading && openQuestions.length === 0 ? (
          <EmptyState>Loading…</EmptyState>
        ) : openQuestions.length > 0 ? (
          openQuestions.map((q) => (
            <ListItem
              key={q.title}
              size="small"
              active={activeDocSection === 'questions' && activeDocTitle === q.title}
              onClick={() => {
                navigate({ to: '/docs/$section', params: { section: 'questions' } });
                setActiveDocTitle(q.title);
              }}
            >
              {q.title}
            </ListItem>
          ))
        ) : (
          <EmptyState>No open questions</EmptyState>
        )}
      </SidebarSection>

      <SidebarSection label="Progress">
        {progressLoading && progress.length === 0 ? (
          <EmptyState>Loading…</EmptyState>
        ) : progress.length > 0 ? (
          progress.map((p) => (
            <ListItem
              key={p.date}
              size="small"
              active={activeDocSection === 'progress' && activeDocTitle === p.date}
              onClick={() => {
                navigate({ to: '/docs/$section', params: { section: 'progress' } });
                setActiveDocTitle(p.date);
              }}
            >
              {p.date}
            </ListItem>
          ))
        ) : (
          <EmptyState>No progress entries</EmptyState>
        )}
      </SidebarSection>
    </>
  );
};
