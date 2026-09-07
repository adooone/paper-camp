import { runtimeRowLabel } from '@/app/services/hub';
import type { MachineProjectSummary } from '@/types/index';
import { Card, ListItem } from '@dendelion/paper-ui';
import { useRememberedMachines } from '../hooks';

export interface MachineProjectRowProps {
  project: MachineProjectSummary;
  onOpen: () => void;
}

/** A missing project's folder is gone — greyed and unclickable instead of
 * opening an empty desk, but still listed so the user can see it needs `rm`. */
export const MachineProjectRow = ({ project, onOpen }: MachineProjectRowProps) => (
  <ListItem
    size="small"
    className={`min-w-0 ${project.missing ? 'cursor-not-allowed opacity-50' : ''}`}
    disabled={project.missing}
    onClick={project.missing ? undefined : onOpen}
  >
    <span className="truncate">{project.name}</span>
  </ListItem>
);

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
              <MachineProjectRow
                key={project.slug}
                project={project}
                onOpen={() => openProject(machineUrl, project.slug)}
              />
            ))}
          </div>
        </Card>
      ))}
    </>
  );
};
