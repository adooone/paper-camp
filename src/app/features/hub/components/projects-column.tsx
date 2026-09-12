import { type ProjectEntry, projectEntryId } from '@/app/services/project-registry';
import { Card } from '@dendelion/paper-ui';
import { useRuntimeStatuses } from '../hooks';
import { ProjectRow } from './project-row';

export interface ProjectsColumnProps {
  projects: ProjectEntry[];
  onOpen: (id: string) => void;
  onRename: (id: string, label: string) => void;
  onRemove: (id: string) => void;
}

export const ProjectsColumn = ({ projects, onOpen, onRename, onRemove }: ProjectsColumnProps) => {
  const statuses = useRuntimeStatuses(projects);

  return (
    <div className="flex flex-col gap-3">
      <p className="m-0 font-semibold">Projects</p>
      {projects.length === 0 ? (
        <p className="m-0 text-sm opacity-70">Nothing here yet — add a project from the right.</p>
      ) : (
        <Card size="small" texture="kraft">
          <div className="flex flex-col gap-1">
            {projects.map((entry) => {
              const id = projectEntryId(entry);
              return (
                <ProjectRow
                  key={id}
                  entry={entry}
                  status={statuses[entry.runtimeUrl]}
                  onOpen={() => onOpen(id)}
                  onRename={(label) => onRename(id, label)}
                  onRemove={() => onRemove(id)}
                />
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
};
