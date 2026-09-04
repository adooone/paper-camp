import { type ProjectEntry, projectEntryId } from '@/app/services/project-registry';
import { GetStartedCard } from './get-started-card';
import { GithubConnectCard } from './github-connect-card';
import { RememberedMachinesCards } from './remembered-machines-cards';
import { TailnetPeersCard } from './tailnet-peers-card';

export interface AddProjectColumnProps {
  projects: ProjectEntry[];
  onAddRepo: (repoFullName: string) => void;
}

export const AddProjectColumn = ({ projects, onAddRepo }: AddProjectColumnProps) => {
  const chosenRuntimeUrls = projects
    .filter((entry) => entry.kind === 'runtime')
    .map(projectEntryId);

  return (
    <div className="flex flex-col gap-4">
      <p className="m-0 font-semibold">Add a project</p>
      {projects.length === 0 && <GetStartedCard />}
      <RememberedMachinesCards chosenRuntimeUrls={chosenRuntimeUrls} />
      <GithubConnectCard
        chosenRepoNames={projects.filter((entry) => entry.kind === 'github').map(projectEntryId)}
        onAddRepo={onAddRepo}
      />
      <TailnetPeersCard chosenRuntimeUrls={chosenRuntimeUrls} />
    </div>
  );
};
