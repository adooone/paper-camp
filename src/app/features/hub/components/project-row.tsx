import type { HubProjectRow, ProjectRowStamp } from '@/app/services/hub-machines';
import { ListItem, Stamp } from '@dendelion/paper-ui';
import { ProjectActionsMenu } from '../actions';
import { formatLastOpened } from '../helpers/format-last-opened';

function RowStamp({ stamp }: { stamp: ProjectRowStamp }) {
  switch (stamp.kind) {
    case 'running':
      return (
        <Stamp size="small" variant="success">
          {stamp.ideaId ? `Running · ${stamp.ideaId}` : 'Running'}
        </Stamp>
      );
    case 'interrupted':
      return (
        <Stamp size="small" variant="error">
          {stamp.count} interrupted
        </Stamp>
      );
    case 'missing':
      return (
        <Stamp size="small" variant="neutral">
          Missing
        </Stamp>
      );
    case 'idle':
      return (
        <Stamp size="small" variant="neutral">
          Idle
        </Stamp>
      );
  }
}

export interface ProjectRowProps {
  row: HubProjectRow;
  chosen: boolean;
  onOpen: () => void;
  onRename: (label: string) => void;
  onForget: () => void;
}

export const ProjectRow = ({ row, chosen, onOpen, onRename, onForget }: ProjectRowProps) => {
  const missing = row.stamp.kind === 'missing';
  const lastOpened = formatLastOpened(row.lastOpenedAt);

  return (
    <div className="flex items-center gap-1">
      <ListItem
        size="medium"
        className={`min-w-0 flex-1 ${missing ? 'cursor-not-allowed opacity-50' : ''}`}
        disabled={missing}
        onClick={missing ? undefined : onOpen}
        action={<RowStamp stamp={row.stamp} />}
      >
        <span className="flex min-w-0 flex-col gap-0.5 text-left">
          <span className="flex min-w-0 flex-wrap items-baseline gap-2">
            <span className="break-words">{row.slug}</span>
            {row.packageName && (
              <span className="break-words font-mono text-2xs opacity-60">{row.packageName}</span>
            )}
          </span>
          {lastOpened && (
            <span className="break-words font-handwritten text-2xs opacity-60">
              Opened {lastOpened}
            </span>
          )}
        </span>
      </ListItem>
      {chosen && (
        <ProjectActionsMenu
          projectName={row.slug}
          currentLabel={row.label ?? ''}
          onRename={onRename}
          onRemove={onForget}
        />
      )}
    </div>
  );
};
