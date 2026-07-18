import { useResolvedDocSection } from '@/app/hooks';
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
  const repoDocs = useAppStore((s) => s.repoDocs);
  const repoDocsLoading = useAppStore((s) => s.repoDocsLoading);
  const loadRepoDocs = useAppStore((s) => s.loadRepoDocs);
  const activeDocTitle = useAppStore((s) => s.activeDocTitle);
  const setActiveDocTitle = useAppStore((s) => s.setActiveDocTitle);
  const docSearchQuery = useAppStore((s) => s.docSearchQuery);
  const setDocSearchQuery = useAppStore((s) => s.setDocSearchQuery);
  const activeDocSection = useResolvedDocSection();
  const navigate = useNavigate();

  useEffect(() => {
    loadRepoDocs();
  }, [loadRepoDocs]);

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
    </>
  );
};
