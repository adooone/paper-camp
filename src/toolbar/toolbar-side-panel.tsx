import {
  CloseIcon,
  Divider,
  IconButton,
  colors,
  getTextureStyles,
  withAlpha,
} from '@dendelion/paper-ui';
import type { CSSProperties, ReactNode } from 'react';
import { useEffect, useState } from 'react';

const panelStyle: CSSProperties = {
  ...getTextureStyles('chalkboard'),
  position: 'fixed',
  top: '2rem',
  bottom: 0,
  right: 0,
  width: 'min(22rem, 100vw)',
  display: 'flex',
  flexDirection: 'column',
  color: colors.chalkboardText,
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
