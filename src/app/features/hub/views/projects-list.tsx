import { runtimeRowLabel } from '@/app/services/hub';
import { mountPrefix } from '@/app/services/mount';
import {
  type RuntimeConnection,
  removeRuntime,
  selectRuntime,
} from '@/app/services/runtime-connection';
import { CLIENT_VERSION } from '@/app/services/version';
import { Card, CloseIcon, IconButton, ListItem, Stamp, Tooltip } from '@dendelion/paper-ui';
import type { ReactNode } from 'react';
import { RenameRuntimeButton } from '../actions';
import { AddByRuntimeUrlCard } from '../components';
import { type RuntimeStatus, useRuntimeStatuses } from '../hooks';

// A full load, not a client navigation: the runtime URL and API base are read once
// at startup. Lands on the app root, not the current (hub) path, to avoid a loop back here.
function enterProject(runtimeUrl: string): void {
  selectRuntime(runtimeUrl, window.localStorage);
  window.location.assign(mountPrefix || '/');
}

function StatusStamp({ status }: { status: RuntimeStatus | undefined }): ReactNode {
  if (!status) {
    return (
      <Stamp size="small" variant="neutral">
        Checking…
      </Stamp>
    );
  }
  if (!status.reachable) {
    return (
      <Stamp size="small" variant="info">
        Plan-only
      </Stamp>
    );
  }
  if (status.versionSkew) {
    return (
      <Tooltip
        content={`Runtime is on ${status.remoteVersion}, this client is on ${CLIENT_VERSION}`}
      >
        <Stamp size="small" variant="warning">
          Version mismatch
        </Stamp>
      </Tooltip>
    );
  }
  return (
    <Stamp size="small" variant="success">
      Can execute
    </Stamp>
  );
}

interface ProjectsListProps {
  runtimes: RuntimeConnection[];
  onChange: () => void;
}

export const ProjectsList = ({ runtimes, onChange }: ProjectsListProps) => {
  const statuses = useRuntimeStatuses(runtimes);
  return (
    <div className="flex flex-col gap-4">
      <Card size="small" texture="kraft" className="flex flex-col gap-2 text-left">
        <p className="m-0 font-semibold">Projects</p>
        <div className="flex flex-col gap-1">
          {runtimes.map((runtime) => {
            const status = statuses[runtime.runtimeUrl];
            const displayName = runtime.label ?? status?.name;
            return (
              <div key={runtime.runtimeUrl} className="flex items-center gap-1">
                <ListItem
                  size="small"
                  className="flex-1"
                  onClick={() => enterProject(runtime.runtimeUrl)}
                  action={<StatusStamp status={status} />}
                >
                  {displayName ? (
                    <span className="flex flex-col gap-0.5 text-left">
                      <span>{displayName}</span>
                      <span className="font-handwritten text-2xs opacity-60">
                        {runtimeRowLabel(runtime.runtimeUrl)}
                      </span>
                    </span>
                  ) : (
                    runtimeRowLabel(runtime.runtimeUrl)
                  )}
                </ListItem>
                <RenameRuntimeButton
                  runtimeUrl={runtime.runtimeUrl}
                  currentLabel={runtime.label ?? status?.name ?? ''}
                  onRenamed={onChange}
                />
                <IconButton
                  variant="danger"
                  size="small"
                  aria-label={`Remove ${displayName ?? runtimeRowLabel(runtime.runtimeUrl)}`}
                  icon={<CloseIcon size={14} />}
                  onClick={(e) => {
                    e.stopPropagation();
                    removeRuntime(runtime.runtimeUrl, window.localStorage);
                    onChange();
                  }}
                />
              </div>
            );
          })}
        </div>
      </Card>
      <AddByRuntimeUrlCard />
    </div>
  );
};
