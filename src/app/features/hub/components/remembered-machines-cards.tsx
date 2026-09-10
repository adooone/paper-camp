import { runtimeRowLabel } from '@/app/services/hub';
import type { MachineProjectSummary } from '@/types/index';
import { Button, Card, ListItem, Stamp, Tooltip } from '@dendelion/paper-ui';
import { type MachineReach, useRememberedMachines } from '../hooks';

export interface MachineProjectRowProps {
  project: MachineProjectSummary;
  onOpen: () => void;
}

/** A missing project's folder is gone — greyed and unclickable instead of
 * opening an empty desk, but still listed so the user can see it needs `rm`.
 * A busy one gets the same Running stamp the project list shows, from the
 * same `busy` flag, so the two lists agree on what an agent is doing. */
export const MachineProjectRow = ({ project, onOpen }: MachineProjectRowProps) => (
  <ListItem
    size="small"
    className={`min-w-0 ${project.missing ? 'cursor-not-allowed opacity-50' : ''}`}
    disabled={project.missing}
    onClick={project.missing ? undefined : onOpen}
    action={
      project.busy ? (
        <Stamp size="small" variant="success">
          Running
        </Stamp>
      ) : undefined
    }
  >
    <span className="truncate">{project.name}</span>
    {project.slug !== project.name && (
      <span className="ml-2 shrink-0 font-mono text-2xs opacity-50">{project.slug}</span>
    )}
  </ListItem>
);

export const pendingUpdateStampLabel = (pendingUpdateVersion: string | null): string | null =>
  pendingUpdateVersion ? `Update to ${pendingUpdateVersion}` : null;

export const PendingUpdateStamp = ({
  pendingUpdateVersion,
}: {
  pendingUpdateVersion: string | null;
}) => {
  const label = pendingUpdateStampLabel(pendingUpdateVersion);
  if (!label) return null;
  return (
    <Tooltip content="Waiting for every project on this machine to go idle before installing.">
      <Stamp size="small" variant="info">
        {label}
      </Stamp>
    </Tooltip>
  );
};

/** What the card says while the machine's project list is not on screen —
 * the browser's own local-network prompt is invisible to the page, so the
 * card has to name it. */
export const machineReachMessage = (
  reach: MachineReach,
  host: string,
  projectCount: number,
): string | null => {
  switch (reach) {
    case 'loading':
      return `Reaching ${host}…`;
    case 'waiting':
      return `Still reaching ${host}. If the browser asks to allow this site to access your local network, allow it.`;
    case 'unreachable':
      return `Couldn't reach ${host} from this device. Check that this device is on the same tailnet or network, and that the browser allows this site local-network access.`;
    case 'ready':
      return projectCount === 0 ? 'Every project on this machine is already in your list.' : null;
  }
};

export interface RememberedMachinesCardsProps {
  chosenRuntimeUrls: string[];
}

export const RememberedMachinesCards = ({ chosenRuntimeUrls }: RememberedMachinesCardsProps) => {
  const { machines, openProject, retry } = useRememberedMachines(chosenRuntimeUrls);

  return (
    <>
      {machines.map(({ machineUrl, reach, projects, pendingUpdateVersion }) => {
        const host = runtimeRowLabel(machineUrl);
        const message = machineReachMessage(reach, host, projects.length);
        return (
          <Card
            key={machineUrl}
            size="small"
            texture="kraft"
            className="flex flex-1 flex-col gap-2 text-left"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="m-0 font-semibold">{host}</p>
              <PendingUpdateStamp pendingUpdateVersion={pendingUpdateVersion} />
            </div>
            {message && <p className="m-0 font-handwritten text-sm opacity-70">{message}</p>}
            {reach === 'unreachable' && (
              <div>
                <Button size="small" variant="secondary" onClick={() => retry(machineUrl)}>
                  Try again
                </Button>
              </div>
            )}
            {projects.length > 0 && (
              <div className="flex max-h-[160px] flex-col gap-1 overflow-y-auto">
                {projects.map((project) => (
                  <MachineProjectRow
                    key={project.slug}
                    project={project}
                    onOpen={() => openProject(machineUrl, project.slug)}
                  />
                ))}
              </div>
            )}
          </Card>
        );
      })}
    </>
  );
};
