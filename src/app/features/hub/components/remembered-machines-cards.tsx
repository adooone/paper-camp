import { runtimeRowLabel } from '@/app/services/hub';
import { Card, ListItem } from '@dendelion/paper-ui';
import { useRememberedMachines } from '../hooks';

export interface RememberedMachinesCardsProps {
  chosenRuntimeUrls: string[];
}

export const RememberedMachinesCards = ({ chosenRuntimeUrls }: RememberedMachinesCardsProps) => {
  const { machines, openProject } = useRememberedMachines(chosenRuntimeUrls);

  return (
    <>
      {machines.map(({ machineUrl, projects }) => (
        <Card
          key={machineUrl}
          size="small"
          texture="kraft"
          className="flex flex-1 flex-col gap-2 text-left"
        >
          <p className="m-0 font-semibold">{runtimeRowLabel(machineUrl)}</p>
          <div className="flex max-h-[160px] flex-col gap-1 overflow-y-auto">
            {projects.map((project) => (
              <ListItem
                key={project.slug}
                size="small"
                className="min-w-0"
                onClick={() => openProject(machineUrl, project.slug)}
              >
                <span className="truncate">{project.name}</span>
              </ListItem>
            ))}
          </div>
        </Card>
      ))}
    </>
  );
};
