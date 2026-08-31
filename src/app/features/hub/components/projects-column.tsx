import { type ProjectEntry, projectEntryId } from '@/app/services/project-registry';
import { useRuntimeStatuses } from '../hooks';
import { ProjectRow } from './project-row';

export interface ProjectsColumnProps {
  projects: ProjectEntry[];
  onOpen: (id: string) => void;
  onRename: (id: string, label: string) => void;
  onRemove: (id: string) => void;
}

function isRuntimeEntry(entry: ProjectEntry) {
  return entry.kind === 'runtime';
}

export const ProjectsColumn = ({ projects, onOpen, onRename, onRemove }: ProjectsColumnProps) => {
  const statuses = useRuntimeStatuses(projects.filter(isRuntimeEntry));

  return (
    <div className="flex flex-col gap-3">
      <p className="m-0 font-semibold">Projects</p>
      {projects.length === 0 ? (
        <p className="m-0 text-sm opacity-70">Nothing here yet — add a project from the right.</p>
      ) : (
        <div className="flex flex-col gap-1">
          {projects.map((entry) => {
            const id = projectEntryId(entry);
            return (
              <ProjectRow
                key={id}
                entry={entry}
                status={entry.kind === 'runtime' ? statuses[entry.runtimeUrl] : undefined}
                onOpen={() => onOpen(id)}
                onRename={(label) => onRename(id, label)}
                onRemove={() => onRemove(id)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};
