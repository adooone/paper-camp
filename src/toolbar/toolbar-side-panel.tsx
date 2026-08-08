import { CloseIcon, Divider, IconButton, colors, withAlpha } from '@dendelion/paper-ui';
import type { CSSProperties, ReactNode } from 'react';
import { useEffect, useState } from 'react';

// Mirrors the desk Stack panel's surface (tailwind `bg-desk-bg bg-chalkboard`
// in tailwind.config.ts): noise over a lighter green gradient, so the
// chalkboard cards (#142e22) inside read a shade darker than the panel.
const CHALKBOARD_NOISE = `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='c'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='matrix' values='0 0 0 0 0.15 0 0 0 0 0.28 0 0 0 0 0.20 0 0 0 0.08 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23c)' opacity='1'/%3E%3C/svg%3E")`;

const panelStyle: CSSProperties = {
  position: 'fixed',
  top: 0,
  bottom: 0,
  right: 0,
  width: 'min(22rem, 100vw)',
  display: 'flex',
  flexDirection: 'column',
  backgroundImage: `${CHALKBOARD_NOISE}, linear-gradient(135deg, #264a3a 0%, #1e3a2d 60%)`,
  backgroundRepeat: 'repeat, no-repeat',
  backgroundSize: '200px 200px, auto',
  color: '#e8e4d9',
  borderLeft: `1px solid ${withAlpha(colors.chalkboardBorderBase, 0.2)}`,
  boxShadow: '-2px 0 12px rgba(0, 0, 0, 0.3)',
  transition: 'transform 0.25s ease',
  zIndex: 2147483647,
};

const headerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '0.5rem',
  padding: '0.75rem 1rem',
  flexShrink: 0,
};

const titleStyle: CSSProperties = {
  fontWeight: 700,
  fontSize: '0.875rem',
  color: colors.chalkboardChalk,
};

const closeButtonStyle: CSSProperties = { width: '1.75rem', height: '1.75rem' };

const contentStyle: CSSProperties = {
  flex: 1,
  minHeight: 0,
  overflow: 'hidden',
};

export interface ToolbarSidePanelProps {
  open: boolean;
  title: ReactNode;
  onClose: () => void;
  children?: ReactNode;
}

export const ToolbarSidePanel = ({ open, title, onClose, children }: ToolbarSidePanelProps) => {
  const [shown, setShown] = useState<{ title: ReactNode; children: ReactNode }>({
    title,
    children,
  });

  useEffect(() => {
    if (open) setShown({ title, children });
  }, [open, title, children]);

  return (
    <div
      style={{
        ...panelStyle,
        transform: open ? 'translateX(0)' : 'translateX(100%)',
        pointerEvents: open ? 'auto' : 'none',
      }}
      aria-hidden={!open}
    >
      <div style={headerStyle}>
        <span style={titleStyle}>{shown.title}</span>
        <IconButton
          icon={<CloseIcon />}
          variant="ghost"
          surface="chalkboard"
          size="small"
          label="Close panel"
          onClick={onClose}
          style={closeButtonStyle}
        />
      </div>
      <Divider surface="chalkboard" />
      <div style={contentStyle}>{shown.children}</div>
    </div>
  );
};
