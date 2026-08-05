import { getTextureStyles } from '@dendelion/paper-ui';
import type { CSSProperties, ReactNode } from 'react';

const dockStyle: CSSProperties = {
  position: 'fixed',
  left: 0,
  right: 0,
  bottom: 0,
  zIndex: 2147483647,
  display: 'flex',
  justifyContent: 'center',
};

const pillStyle: CSSProperties = {
  ...getTextureStyles('kraft'),
  margin: '0 0 0.75rem 0',
  padding: '0.375rem 0.75rem',
  borderRadius: '999px',
  border: '1px solid rgba(0, 0, 0, 0.12)',
  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
  fontSize: '0.75rem',
  cursor: 'pointer',
  color: 'var(--pui-text-primary)',
};

const barStyle: CSSProperties = {
  ...getTextureStyles('kraft'),
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  padding: '0.375rem 0.75rem',
  borderTop: '1px solid rgba(0, 0, 0, 0.12)',
  boxShadow: '0 -2px 8px rgba(0, 0, 0, 0.15)',
  fontSize: '0.75rem',
  width: '100%',
  boxSizing: 'border-box',
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

const panelWrapperStyle: CSSProperties = {
  position: 'fixed',
  left: 0,
  right: 0,
  bottom: '2.5rem',
  display: 'flex',
  justifyContent: 'center',
  zIndex: 2147483647,
};

const panelStyle: CSSProperties = {
  ...getTextureStyles('paper'),
  border: '1px solid rgba(0, 0, 0, 0.12)',
  borderRadius: '0.5rem',
  boxShadow: '0 -2px 12px rgba(0, 0, 0, 0.2)',
  padding: '0.75rem',
  maxWidth: '32rem',
  width: '100%',
};

export interface ToolbarSegment {
  id: string;
  glance: ReactNode;
  panel?: ReactNode;
}

export interface ToolbarShellProps {
  segments: ToolbarSegment[];
  expanded: boolean;
  activePanelId: string | null;
  onExpand: () => void;
  onSelectSegment: (id: string) => void;
}

export const ToolbarShell = ({
  segments,
  expanded,
  activePanelId,
  onExpand,
  onSelectSegment,
}: ToolbarShellProps) => {
  if (!expanded) {
    return (
      <div style={dockStyle}>
        <button type="button" style={pillStyle} onClick={onExpand}>
          paper-camp
        </button>
      </div>
    );
  }

  const activeSegment = segments.find((segment) => segment.id === activePanelId);

  return (
    <>
      {activeSegment?.panel && (
        <div style={panelWrapperStyle}>
          <div style={panelStyle}>{activeSegment.panel}</div>
        </div>
      )}
      <div style={dockStyle}>
        <div style={barStyle}>
          {segments.map((segment) => (
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
        </div>
      </div>
    </>
  );
};
