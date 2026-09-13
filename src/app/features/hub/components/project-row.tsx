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
        size="small"
        className={`min-w-0 flex-1 ${missing ? 'cursor-not-allowed opacity-50' : ''}`}
        disabled={missing}
        onClick={missing ? undefined : onOpen}
        action={<RowStamp stamp={row.stamp} />}
      >
        {/* One line: the name carries the row, the package and the last visit trail it. */}
        <span className="flex min-w-0 items-baseline gap-2 text-left">
          <span className="truncate">{row.slug}</span>
          {row.packageName && (
            <span className="shrink-0 font-mono text-2xs opacity-60">{row.packageName}</span>
          )}
          {lastOpened && (
            <span className="ml-auto shrink-0 pr-2 font-handwritten text-2xs opacity-50">
              {lastOpened}
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
