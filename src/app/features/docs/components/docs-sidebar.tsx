import { fetchIconDataUri } from '@/app/services/icon-api';
import { fetchPackageName } from '@/app/services/package-api';
import { useAppStore } from '@/app/stores/app-store';
import { FolderIcon, Icon, ListItem } from '@dendelion/paper-ui';
import { useEffect, useState } from 'react';
import { SidebarSection } from '../../plans/components/sidebar-section';

const kebabToTitle = (s: string) =>
  s.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const simplecaseLabel = (name: string) =>
  name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();

export const DocsSidebar = () => {
  const {
    decisions,
    openQuestions,
    progress,
    repoDocs,
    loadDecisions,
    loadOpenQuestions,
    loadProgress,
    loadRepoDocs,
    activeDocSection,
    setActiveDocSection,
    activeDocTitle,
    setActiveDocTitle,
  } = useAppStore();

  const [projectName, setProjectName] = useState<string | null>(null);
  const [iconDataUri, setIconDataUri] = useState<string | null>(null);

  useEffect(() => {
    loadDecisions();
    loadOpenQuestions();
    loadProgress();
    loadRepoDocs();
    fetchPackageName().then((name) => {
      if (name) setProjectName(kebabToTitle(name));
    });
    fetchIconDataUri().then(setIconDataUri);
  }, [loadDecisions, loadOpenQuestions, loadProgress, loadRepoDocs]);

  const handleSelectDecision = (title: string) => {
    setActiveDocSection('decisions');
    setActiveDocTitle(title);
  };

  const divider = (
    <div style={{ height: 1, background: 'rgba(0,0,0,0.08)', margin: '0.75rem 0.75rem' }} />
  );

  return (
    <aside
      style={{
        width: 220,
        flexShrink: 0,
        height: '100%',
        position: 'sticky',
        top: 0,
        display: 'flex',
        flexDirection: 'column',
        background: 'transparent',
        overflow: 'hidden',
      }}
    >
      <div style={{ padding: '1.25rem 0.75rem 1rem', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {iconDataUri ? (
            <img
              src={iconDataUri}
              alt=""
              style={{ width: 18, height: 18, objectFit: 'contain' }}
            />
          ) : (
            <Icon icon={<FolderIcon />} size="small" />
          )}
          <span
            style={{
              fontFamily: 'Luminari, "Cormorant Garamond", Georgia, serif',
              fontWeight: 600,
              fontSize: '1.25rem',
            }}
          >
            {projectName ?? 'Paper Camp'}
          </span>
        </div>
      </div>

      {divider}

      <div style={{ flex: 1, overflowY: 'auto', paddingTop: '0.25rem' }}>
        <SidebarSection label="Repo Docs">
          {repoDocs.length > 0 ? (
            repoDocs.map((f) => (
              <ListItem
                key={f.name}
                size="small"
                active={activeDocSection === 'repo-docs' && activeDocTitle === f.name}
                onClick={() => {
                  setActiveDocSection('repo-docs');
                  setActiveDocTitle(f.name);
                }}
              >
                {simplecaseLabel(f.name)}
              </ListItem>
            ))
          ) : (
            <span
              className="text-sm"
              style={{ display: 'block', padding: '0.25rem 0.75rem', opacity: 0.35, fontStyle: 'italic' }}
            >
              No repo docs found
            </span>
          )}
        </SidebarSection>

        <SidebarSection label="Decisions">
          {decisions.length > 0 ? (
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
            <span
              className="text-sm"
              style={{ display: 'block', padding: '0.25rem 0.75rem', opacity: 0.35, fontStyle: 'italic' }}
            >
              No decisions yet
            </span>
          )}
        </SidebarSection>

        <SidebarSection label="Open Questions">
          {openQuestions.length > 0 ? (
            openQuestions.map((q) => (
              <ListItem
                key={q.title}
                size="small"
                active={activeDocSection === 'questions' && activeDocTitle === q.title}
                onClick={() => {
                  setActiveDocSection('questions');
                  setActiveDocTitle(q.title);
                }}
              >
                {q.title}
              </ListItem>
            ))
          ) : (
            <span
              className="text-sm"
              style={{ display: 'block', padding: '0.25rem 0.75rem', opacity: 0.35, fontStyle: 'italic' }}
            >
              No open questions
            </span>
          )}
        </SidebarSection>

        <SidebarSection label="Progress">
          {progress.length > 0 ? (
            progress.map((p) => (
              <ListItem
                key={p.date}
                size="small"
                active={activeDocSection === 'progress' && activeDocTitle === p.date}
                onClick={() => {
                  setActiveDocSection('progress');
                  setActiveDocTitle(p.date);
                }}
              >
                {p.date}
              </ListItem>
            ))
          ) : (
            <span
              className="text-sm"
              style={{ display: 'block', padding: '0.25rem 0.75rem', opacity: 0.35, fontStyle: 'italic' }}
            >
              No progress entries
            </span>
          )}
        </SidebarSection>

      </div>
    </aside>
  );
};
