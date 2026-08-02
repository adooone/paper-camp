import type { FileDiffEntry } from '@/types/index';
import { ListItem, Stamp } from '@dendelion/paper-ui';

interface CountBadgeProps {
  additions: number;
  deletions: number;
}

const CountBadge = ({ additions, deletions }: CountBadgeProps) => (
  <span className="inline-flex gap-2 font-mono text-2xs">
    <span className="text-watercolor-green-dark">+{additions}</span>
    <span className="text-watercolor-rose-dark">-{deletions}</span>
  </span>
);

interface FileListSidebarProps {
  files: FileDiffEntry[];
  onSelect: (path: string) => void;
}

export const FileListSidebar = ({ files, onSelect }: FileListSidebarProps) => (
  <div className="sticky top-4 flex w-[288px] shrink-0 flex-col gap-1 max-h-[calc(100vh-64px)] overflow-y-auto">
    {files.map((entry) => (
      <ListItem
        key={entry.path}
        size="small"
        onClick={() => onSelect(entry.path)}
        action={
          <span className="flex items-center gap-2">
            {entry.staged && <Stamp size="small">staged</Stamp>}
            {!entry.binary && (
              <CountBadge additions={entry.additions} deletions={entry.deletions} />
            )}
          </span>
        }
      >
        <span className="block overflow-hidden text-ellipsis whitespace-nowrap font-mono text-2xs">
          {entry.path}
        </span>
      </ListItem>
    ))}
  </div>
);
