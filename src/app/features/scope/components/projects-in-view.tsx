import { Button, SidebarCard, SidebarItem, SidebarLabel } from '@dendelion/paper-ui';
import { useNavigate } from '@tanstack/react-router';
import { type ScopeCountKind, useScope } from '../hooks/use-scope';
import { ScopeProjectRow } from './scope-project-row';

export interface ProjectsInViewProps {
  mode: 'list' | 'switcher';
  countKind: ScopeCountKind;
}

export const ProjectsInView = ({ mode, countKind }: ProjectsInViewProps) => {
  const navigate = useNavigate();
  const { groups, toggle, selectAll, clear, openRow } = useScope(countKind);
  const showHosts = groups.length > 1;

  return (
    <SidebarCard className="shrink-0">
      <div className="flex items-end justify-between gap-2">
        <SidebarLabel>{mode === 'list' ? 'Projects in view' : 'Projects'}</SidebarLabel>
        {mode === 'list' && (
          <span className="flex items-center gap-2 pb-1">
            <Button variant="link" onClick={selectAll} className="text-2xs opacity-70">
              All
            </Button>
            <Button variant="link" onClick={clear} className="text-2xs opacity-70">
              Clear
            </Button>
          </span>
        )}
      </div>
      <div className="flex flex-col">
        {groups.map((group) => (
          <div key={group.machineUrl} className="flex flex-col">
            {showHosts && (
              <p className="m-0 truncate px-2 pt-2 pb-1 font-mono text-2xs opacity-50">
                {group.host}
              </p>
            )}
            {group.rows.map((row) => (
              <ScopeProjectRow
                key={row.key}
                row={row}
                mode={mode}
                asleep={group.asleep}
                showCount={countKind !== null}
                onToggle={toggle}
                onOpen={openRow}
              />
            ))}
          </div>
        ))}
        <SidebarItem onClick={() => navigate({ to: '/projects' })}>
          <span className="opacity-70">All machines</span>
        </SidebarItem>
      </div>
    </SidebarCard>
  );
};
