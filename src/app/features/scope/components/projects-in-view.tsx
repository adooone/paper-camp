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

  return (
    <SidebarCard className="shrink-0">
      <SidebarLabel>
        <span className="flex items-center justify-between gap-2">
          <span>Projects in view</span>
          {mode === 'list' && (
            <span className="flex gap-1">
              <Button size="tiny" variant="ghost" onClick={selectAll}>
                All
              </Button>
              <Button size="tiny" variant="ghost" onClick={clear}>
                Clear
              </Button>
            </span>
          )}
        </span>
      </SidebarLabel>
      <div className="flex flex-col gap-3">
        {groups.map((group) => (
          <div key={group.machineUrl} className="flex flex-col gap-1">
            <p className="m-0 px-3 font-handwritten text-2xs opacity-60">{group.host}</p>
            <div className="flex flex-col">
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
          </div>
        ))}
      </div>
      <SidebarItem onClick={() => navigate({ to: '/projects' })}>All machines</SidebarItem>
    </SidebarCard>
  );
};
