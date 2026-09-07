import { Card } from '@dendelion/paper-ui';
import { useThisMachine } from '../hooks';
import { MachineProjectRow } from './remembered-machines-cards';

export interface ThisMachineCardProps {
  chosenRuntimeUrls: string[];
}

export const ThisMachineCard = ({ chosenRuntimeUrls }: ThisMachineCardProps) => {
  const { projects, openProject } = useThisMachine(chosenRuntimeUrls);
  if (projects.length === 0) return null;

  return (
    <Card size="small" texture="kraft" className="flex flex-1 flex-col gap-2 text-left">
      <p className="m-0 font-semibold">This machine</p>
      <div className="flex max-h-[160px] flex-col gap-1 overflow-y-auto">
        {projects.map((project) => (
          <MachineProjectRow
            key={project.slug}
            project={project}
            onOpen={() => openProject(project.slug)}
          />
        ))}
      </div>
    </Card>
  );
};
