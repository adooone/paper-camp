import type { HubMachine } from '@/app/services/hub-machines';
import { CLIENT_VERSION } from '@/app/services/version';
import { surface } from '@/app/styles/tokens';
import { Button, Card, Stamp, Tooltip } from '@dendelion/paper-ui';
import { ProjectRow } from './project-row';

function ReachStamp({ machine, onRetry }: { machine: HubMachine; onRetry: () => void }) {
  if (machine.reach === 'waiting') {
    return (
      <Stamp size="small" variant="info">
        Waiting for local network
      </Stamp>
    );
  }
  if (machine.reach === 'unreachable') {
    return (
      <div className="flex items-center gap-1">
        <Stamp size="small" variant="info">
          Offline
        </Stamp>
        <Button size="tiny" variant="ghost" onClick={onRetry}>
          Try again
        </Button>
      </div>
    );
  }
  return null;
}

export interface MachineSectionProps {
  machine: HubMachine;
  chosenRuntimeUrls: Set<string>;
  onOpenRow: (row: HubMachine['projects'][number]) => void;
  onRenameRow: (runtimeUrl: string, label: string) => void;
  onForgetRow: (runtimeUrl: string) => void;
  onRetry: () => void;
}

export const MachineSection = ({
  machine,
  chosenRuntimeUrls,
  onOpenRow,
  onRenameRow,
  onForgetRow,
  onRetry,
}: MachineSectionProps) => (
  <div className="flex flex-col gap-1.5">
    <div className="flex flex-wrap items-baseline gap-2">
      <p className="m-0 font-handwritten text-base">{machine.host}</p>
      {machine.runtimeVersion && (
        <span className="font-mono text-2xs opacity-60">{machine.runtimeVersion}</span>
      )}
      {machine.pendingUpdateVersion && (
        <Tooltip content="Waiting for every project on this machine to go idle before installing.">
          <Stamp size="small" variant="info">
            Update to {machine.pendingUpdateVersion}
          </Stamp>
        </Tooltip>
      )}
      {machine.versionMismatch && (
        <Tooltip
          content={`Runtime is on ${machine.runtimeVersion}, this client is on ${CLIENT_VERSION}`}
        >
          <Stamp size="small" variant="warning">
            Version mismatch
          </Stamp>
        </Tooltip>
      )}
      <ReachStamp machine={machine} onRetry={onRetry} />
    </div>
    {machine.projects.length > 0 && (
      <Card size="small" texture={surface.card}>
        <div className="flex flex-col">
          {machine.projects.map((row) => (
            <ProjectRow
              key={row.runtimeUrl}
              row={row}
              chosen={chosenRuntimeUrls.has(row.runtimeUrl)}
              onOpen={() => onOpenRow(row)}
              onRename={(label) => onRenameRow(row.runtimeUrl, label)}
              onForget={() => onForgetRow(row.runtimeUrl)}
            />
          ))}
        </div>
      </Card>
    )}
  </div>
);
