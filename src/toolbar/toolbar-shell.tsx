import { getTextureStyles } from '@dendelion/paper-ui';
import type { CSSProperties, ReactNode } from 'react';

const dockStyle: CSSProperties = {
  position: 'relative',
  width: '100%',
  zIndex: 2147483647,
  display: 'flex',
  justifyContent: 'center',
};

const barStyle: CSSProperties = {
  ...getTextureStyles('kraft'),
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  padding: '0.375rem 0.75rem',
  borderBottom: '1px solid rgba(0, 0, 0, 0.12)',
  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
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
  top: '2.5rem',
  display: 'flex',
  justifyContent: 'center',
  zIndex: 2147483647,
};

const panelStyle: CSSProperties = {
  ...getTextureStyles('paper'),
  border: '1px solid rgba(0, 0, 0, 0.12)',
  borderRadius: '0.5rem',
  boxShadow: '0 2px 12px rgba(0, 0, 0, 0.2)',
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
  activePanelId: string | null;
  onSelectSegment: (id: string) => void;
}

export const ToolbarShell = ({ segments, activePanelId, onSelectSegment }: ToolbarShellProps) => {
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
