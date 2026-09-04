import { type ProjectEntry, projectEntryId } from '@/app/services/project-registry';
import { ConnectMachineCard } from './connect-machine-card';
import { GithubConnectCard } from './github-connect-card';
import { MachineLinkCard } from './machine-link-card';
import { TailnetPeersCard } from './tailnet-peers-card';

export interface AddProjectColumnProps {
  projects: ProjectEntry[];
  onAddRepo: (repoFullName: string) => void;
}

export const AddProjectColumn = ({ projects, onAddRepo }: AddProjectColumnProps) => (
  <div className="flex flex-col gap-4">
    <p className="m-0 font-semibold">Add a project</p>
    <MachineLinkCard />
    <GithubConnectCard
      chosenRepoNames={projects.filter((entry) => entry.kind === 'github').map(projectEntryId)}
      onAddRepo={onAddRepo}
    />
    <TailnetPeersCard
      chosenRuntimeUrls={projects.filter((entry) => entry.kind === 'runtime').map(projectEntryId)}
    />
    <ConnectMachineCard />
  </div>
);
