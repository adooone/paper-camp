import { IconButton } from '@dendelion/paper-ui';
import type { CSSProperties } from 'react';
import { PaperLogo } from './paper-logo';
import { useIslandReveal } from './use-island-reveal';

const dockStyle: CSSProperties = {
  position: 'fixed',
  bottom: '1.5rem',
  left: '50%',
  transform: 'translateX(-50%)',
  zIndex: 2147483647,
  pointerEvents: 'none',
};

const islandStyle: CSSProperties = {
  pointerEvents: 'auto',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '0.5rem',
};

const revealStyle: CSSProperties = {
  minWidth: '16rem',
  minHeight: '5rem',
};

const triggerStyle: CSSProperties = {
  borderRadius: '9999px',
};

export const IslandTrigger = () => {
  const { open, rootRef, rootProps, triggerProps } = useIslandReveal();

  return (
    <div style={dockStyle}>
      <div ref={rootRef} style={islandStyle} {...rootProps}>
        {open && <div style={revealStyle} />}
        <IconButton
          surface="paper"
          size="large"
          label="Open paper camp"
          icon={<PaperLogo size={22} />}
          style={triggerStyle}
          aria-expanded={open}
          {...triggerProps}
        />
      </div>
    </div>
  );
};
