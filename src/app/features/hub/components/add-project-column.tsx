import { type ProjectEntry, projectEntryId } from '@/app/services/project-registry';
import { GetStartedCard } from './get-started-card';
import { RememberedMachinesCards } from './remembered-machines-cards';
import { ThisMachineCard } from './this-machine-card';

export interface AddProjectColumnProps {
  projects: ProjectEntry[];
}

export const AddProjectColumn = ({ projects }: AddProjectColumnProps) => {
  const chosenRuntimeUrls = projects.map(projectEntryId);

  return (
    <div className="flex flex-col gap-4">
      <p className="m-0 font-semibold">Add a project</p>
      {projects.length === 0 && <GetStartedCard />}
      <ThisMachineCard chosenRuntimeUrls={chosenRuntimeUrls} />
      <RememberedMachinesCards chosenRuntimeUrls={chosenRuntimeUrls} />
    </div>
  );
};
