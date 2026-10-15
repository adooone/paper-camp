import { SidebarAction, SidebarSection } from '@/app/components';
import { SidebarItem, SidebarLabel } from '@dendelion/folk-ui';
import { useNavigate } from '@tanstack/react-router';
import { type ScopeCountKind, useScope } from '../hooks/use-scope';
import { ScopeProjectRow } from './scope-project-row';

export interface ProjectsInViewProps {
  countKind: ScopeCountKind;
}

export const ProjectsInView = ({ countKind }: ProjectsInViewProps) => {
  const navigate = useNavigate();
  const { groups, toggle, selectAll, clear } = useScope(countKind);
  const showHosts = groups.length > 1;

  return (
    <SidebarSection>
      <div className="flex items-end justify-between gap-2">
        <SidebarLabel>Projects in view</SidebarLabel>
        <span className="flex items-center gap-1 pb-0.5">
          <SidebarAction onClick={selectAll}>All</SidebarAction>
          <SidebarAction onClick={clear}>Clear</SidebarAction>
        </span>
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
                asleep={group.asleep}
                showCount={countKind !== null}
                onToggle={toggle}
              />
            ))}
          </div>
        ))}
        <SidebarItem onClick={() => navigate({ to: '/projects' })}>
          <span className="opacity-70">All machines</span>
        </SidebarItem>
      </div>
    </SidebarSection>
  );
};
