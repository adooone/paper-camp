import { AddByRuntimeUrlCard } from './add-runtime-card';
import { GithubConnectCard } from './github-connect-card';

export interface AddProjectColumnProps {
  onProjectsChange: () => void;
}

export const AddProjectColumn = ({ onProjectsChange }: AddProjectColumnProps) => (
  <div className="flex flex-col gap-4">
    <p className="m-0 font-semibold">Add a project</p>
    <GithubConnectCard onProjectsChange={onProjectsChange} />
    <AddByRuntimeUrlCard />
  </div>
);
