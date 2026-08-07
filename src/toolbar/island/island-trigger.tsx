import { IconButton } from '@dendelion/paper-ui';
import type { CSSProperties } from 'react';
import { PaperLogo } from './paper-logo';

const dockStyle: CSSProperties = {
  position: 'fixed',
  bottom: '1.5rem',
  left: '50%',
  transform: 'translateX(-50%)',
  zIndex: 2147483647,
  pointerEvents: 'none',
};

const triggerStyle: CSSProperties = {
  pointerEvents: 'auto',
  borderRadius: '9999px',
};

export const IslandTrigger = () => (
  <div style={dockStyle}>
    <IconButton
      surface="paper"
      size="large"
      label="Open paper camp"
      icon={<PaperLogo size={22} />}
      style={triggerStyle}
    />
  </div>
);
