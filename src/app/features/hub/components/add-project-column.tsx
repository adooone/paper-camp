import { type ProjectEntry, projectEntryId } from '@/app/services/project-registry';
import { AddByRuntimeUrlCard } from './add-runtime-card';
import { GithubConnectCard } from './github-connect-card';

export interface AddProjectColumnProps {
  projects: ProjectEntry[];
  onProjectsChange: () => void;
}

export const AddProjectColumn = ({ projects, onProjectsChange }: AddProjectColumnProps) => (
  <div className="flex flex-col gap-4">
    <p className="m-0 font-semibold">Add a project</p>
    <GithubConnectCard
      chosenRepoNames={projects.filter((entry) => entry.kind === 'github').map(projectEntryId)}
      onProjectsChange={onProjectsChange}
    />
    <AddByRuntimeUrlCard />
  </div>
);
