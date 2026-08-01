import { color, fontFamily, fontSize, layout, space } from '@/app/styles/tokens';
import type { FileDiffEntry } from '@/types/index';
import { ListItem, Stamp } from '@dendelion/paper-ui';

interface CountBadgeProps {
  additions: number;
  deletions: number;
}

const CountBadge = ({ additions, deletions }: CountBadgeProps) => (
  <span
    style={{
      display: 'inline-flex',
      gap: space[2],
      fontFamily: fontFamily.mono,
      fontSize: fontSize['2xs'],
    }}
  >
    <span style={{ color: color.accentGreenDark }}>+{additions}</span>
    <span style={{ color: color.accentRoseDark }}>-{deletions}</span>
  </span>
);

interface FileListSidebarProps {
  files: FileDiffEntry[];
  onSelect: (path: string) => void;
}

export const FileListSidebar = ({ files, onSelect }: FileListSidebarProps) => (
  <div
    style={{
      position: 'sticky',
      top: space[4],
      display: 'flex',
      flexDirection: 'column',
      gap: space[1],
      width: layout.diffSidebarWidth,
      flexShrink: 0,
      maxHeight: `calc(100vh - ${layout.headerHeight})`,
      overflowY: 'auto',
    }}
  >
    {files.map((entry) => (
      <ListItem
        key={entry.path}
        size="small"
        onClick={() => onSelect(entry.path)}
        action={
          <span style={{ display: 'flex', alignItems: 'center', gap: space[2] }}>
            {entry.staged && <Stamp size="small">staged</Stamp>}
            {!entry.binary && (
              <CountBadge additions={entry.additions} deletions={entry.deletions} />
            )}
          </span>
        }
      >
        <span
          style={{
            fontFamily: fontFamily.mono,
            fontSize: fontSize['2xs'],
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            display: 'block',
          }}
        >
          {entry.path}
        </span>
      </ListItem>
    ))}
  </div>
);
