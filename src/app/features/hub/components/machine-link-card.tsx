import { Card, ListItem } from '@dendelion/paper-ui';
import { useMachineLink } from '../hooks';

export const MachineLinkCard = () => {
  const machine = useMachineLink();
  if (!machine) return null;

  return (
    <Card size="small" texture="kraft" className="flex flex-1 flex-col gap-2 text-left">
      <p className="m-0 font-semibold">Choose a project</p>
      <p className="m-0 text-sm opacity-70">
        Projects registered on <code>{machine.machineUrl}</code>.
      </p>
      {machine.loading ? (
        <p className="m-0 text-sm opacity-70">Loading…</p>
      ) : machine.projects && machine.projects.length > 0 ? (
        <div className="flex max-h-[160px] flex-col gap-1 overflow-y-auto">
          {machine.projects.map((project) => (
            <ListItem
              key={project.slug}
              size="small"
              className="min-w-0"
              onClick={() => machine.openProject(project.slug)}
            >
              <span className="truncate">{project.name}</span>
            </ListItem>
          ))}
        </div>
      ) : (
        <p className="m-0 text-sm opacity-70">No registered projects found there.</p>
      )}
    </Card>
  );
};
