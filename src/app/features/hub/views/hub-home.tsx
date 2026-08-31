import { Divider } from '@dendelion/paper-ui';
import { AddProjectColumn, ProjectsColumn } from '../components';
import { useProjects } from '../hooks';

export const HubHome = () => {
  const { projects, refresh, renameEntry, removeEntry, openEntry } = useProjects();

  return (
    <div className="flex flex-col gap-6 md:flex-row md:items-stretch">
      <div className="min-w-0 md:flex-1">
        <ProjectsColumn
          projects={projects}
          onOpen={openEntry}
          onRename={renameEntry}
          onRemove={removeEntry}
        />
      </div>
      <Divider orientation="horizontal" className="md:hidden" />
      <Divider orientation="vertical" className="hidden md:block" />
      <div className="min-w-0 md:flex-1">
        <AddProjectColumn projects={projects} onProjectsChange={refresh} />
      </div>
    </div>
  );
};
