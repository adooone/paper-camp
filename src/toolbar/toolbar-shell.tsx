import { MoreIcon } from '@/app/components/icons';
import { Button, Menu, type MenuEntry } from '@dendelion/paper-ui';
import type { CSSProperties, ReactNode } from 'react';
import { ToolbarSidePanel } from './toolbar-side-panel';

const dockStyle: CSSProperties = {
  position: 'relative',
  width: '100%',
  zIndex: 2147483647,
};

const segmentButtonStyle: CSSProperties = {
  background: 'none',
  backgroundColor: 'transparent',
  border: 'none',
  padding: '0.25rem 0.5rem',
  cursor: 'pointer',
  color: 'var(--pui-text-primary)',
  fontSize: '0.75rem',
};

const activeSegmentButtonStyle: CSSProperties = {
  ...segmentButtonStyle,
  backgroundColor: 'rgba(0, 0, 0, 0.08)',
  borderRadius: '0.25rem',
};

export interface ToolbarSegment {
  id: string;
  glance: ReactNode;
  panel?: ReactNode;
  // Earns a permanent spot inline in the bar; unpinned segments live in the overflow menu.
  pinned?: boolean;
}

export interface ToolbarShellProps {
  renderStatusBar: (trailing: ReactNode) => ReactNode;
  segments: ToolbarSegment[];
  activePanelId: string | null;
  onSelectSegment: (id: string) => void;
}

export const ToolbarShell = ({
  renderStatusBar,
  segments,
  activePanelId,
  onSelectSegment,
}: ToolbarShellProps) => {
  const activeSegment = segments.find((segment) => segment.id === activePanelId);
  const pinnedSegments = segments.filter((segment) => segment.pinned);
  const overflowSegments = segments.filter((segment) => !segment.pinned);

  const overflowItems: MenuEntry[] = overflowSegments.map((segment) => ({
    id: segment.id,
    label: segment.glance,
    disabled: !segment.panel,
    onSelect: () => onSelectSegment(segment.id),
  }));

  const trailing = (
    <>
      {pinnedSegments.map((segment) => (
        <button
          key={segment.id}
          type="button"
          style={segment.id === activePanelId ? activeSegmentButtonStyle : segmentButtonStyle}
          onClick={() => onSelectSegment(segment.id)}
          disabled={!segment.panel}
          aria-expanded={segment.panel ? segment.id === activePanelId : undefined}
        >
          {segment.glance}
        </button>
      ))}
      {overflowItems.length > 0 && (
        <Menu
          align="end"
          trigger={
            <Button variant="ghost" size="small" icon={<MoreIcon />} aria-label="More actions" />
          }
          items={overflowItems}
        />
      )}
    </>
  );

  return (
    <>
      <ToolbarSidePanel
        open={Boolean(activeSegment?.panel)}
        title={activeSegment?.glance}
        onClose={() => activeSegment && onSelectSegment(activeSegment.id)}
      >
        {activeSegment?.panel}
      </ToolbarSidePanel>
      <div style={dockStyle}>{renderStatusBar(trailing)}</div>
    </>
  );
};
