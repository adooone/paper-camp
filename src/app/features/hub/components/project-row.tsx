import type { ProjectEntry } from '@/app/services/project-registry';
import { CLIENT_VERSION } from '@/app/services/version';
import { ListItem, Stamp, Tooltip } from '@dendelion/paper-ui';
import { ProjectActionsMenu } from '../actions';
import type { ProjectActionsMenuProps } from '../actions/project-actions-menu';
import { projectAddress, projectName } from '../helpers/project-row';
import type { RuntimeStatus } from '../hooks';

interface StatusStampProps {
  entry: ProjectEntry;
  status: RuntimeStatus | undefined;
}

function StatusStamp({ entry, status }: StatusStampProps) {
  if (entry.kind === 'github') {
    return (
      <Stamp size="small" variant="info">
        Plan-only
      </Stamp>
    );
  }
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

export interface ProjectRowProps {
  entry: ProjectEntry;
  status: RuntimeStatus | undefined;
  onOpen: () => void;
  onRename: ProjectActionsMenuProps['onRename'];
  onRemove: () => void;
}

export const ProjectRow = ({ entry, status, onOpen, onRename, onRemove }: ProjectRowProps) => {
  const address = projectAddress(entry);
  const name = projectName(entry, status?.name ?? null);

  return (
    <div className="flex items-center gap-1">
      <ListItem
        size="medium"
        className="min-w-0 flex-1"
        onClick={onOpen}
        action={<StatusStamp entry={entry} status={status} />}
      >
        {name ? (
          <span className="flex min-w-0 flex-col gap-0.5 text-left">
            <span className="break-words">{name}</span>
            <span className="break-words font-handwritten text-2xs opacity-60">{address}</span>
          </span>
        ) : (
          <span className="block break-words text-left">{address}</span>
        )}
      </ListItem>
      <ProjectActionsMenu
        projectName={name ?? address}
        currentLabel={entry.label ?? ''}
        onRename={onRename}
        onRemove={onRemove}
      />
    </div>
  );
};
