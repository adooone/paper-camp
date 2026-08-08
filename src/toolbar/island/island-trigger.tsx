import type { CSSProperties, ReactNode } from 'react';
import { PaperLogo } from './paper-logo';
import { useIslandReveal } from './use-island-reveal';

const SPRING = 'cubic-bezier(0.34, 1.56, 0.64, 1)';

const dockStyle: CSSProperties = {
  position: 'fixed',
  bottom: '1.5rem',
  left: '50%',
  transform: 'translateX(-50%)',
  zIndex: 2147483647,
  pointerEvents: 'none',
};

const rootStyle: CSSProperties = {
  position: 'relative',
  display: 'inline-flex',
  pointerEvents: 'auto',
};

// A plain circle instead of paper-ui's IconButton — its SVG blob background
// reads as an arbitrary shape at trigger size; the owner wants it round.
const triggerStyle = (open: boolean): CSSProperties => ({
  width: '48px',
  height: '48px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: '1px solid rgba(61, 53, 43, 0.25)',
  borderRadius: '50%',
  background: '#E5DBC4',
  color: 'var(--pui-text-primary)',
  cursor: 'pointer',
  boxShadow: '0 4px 10px rgba(61, 53, 43, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.5)',
  transform: open ? 'scale(0.6)' : undefined,
  opacity: open ? 0 : 1,
  visibility: open ? 'hidden' : 'visible',
  transition: open
    ? 'transform 0.24s ease, opacity 0.18s ease, visibility 0s 0.24s'
    : `transform 0.3s ${SPRING}, opacity 0.2s ease, visibility 0s, box-shadow 0.2s ease`,
});

const cardLayerStyle = (open: boolean): CSSProperties => ({
  position: 'absolute',
  bottom: 0,
  left: '50%',
  transformOrigin: 'bottom center',
  transform: open ? 'translateX(-50%) scale(1)' : 'translateX(-50%) scale(0.82)',
  opacity: open ? 1 : 0,
  visibility: open ? 'visible' : 'hidden',
  pointerEvents: open ? 'auto' : 'none',
  transition: open
    ? `transform 0.34s ${SPRING}, opacity 0.22s ease, visibility 0s`
    : 'transform 0.26s ease, opacity 0.2s ease, visibility 0s 0.26s',
});

// paper-ui's Island fixes its own position/transform through a hashed class we
// can't target by name; this scoped child-selector rule (higher specificity)
// neutralises that so the card flows inside the grow-from-trigger layer we animate.
const islandCss = `
.pc-island-trigger:hover {
  border-color: rgba(61, 53, 43, 0.5);
}
.pc-island-card > section {
  position: static;
  transform: none;
  bottom: auto;
  left: auto;
  z-index: auto;
}
@media (prefers-reduced-motion: reduce) {
  .pc-island-card, .pc-island-trigger {
    transition: none !important;
  }
}`;

export const IslandTrigger = ({ children }: { children?: ReactNode }) => {
  const { open, rootRef, rootProps, triggerProps } = useIslandReveal();

  return (
    <div style={dockStyle}>
      <style>{islandCss}</style>
      <div ref={rootRef} style={rootStyle} {...rootProps}>
        <button
          type="button"
          className="pc-island-trigger"
          aria-label="Open paper camp"
          style={triggerStyle(open)}
          aria-expanded={open}
          {...triggerProps}
        >
          <PaperLogo size={22} />
        </button>
        <div className="pc-island-card" style={cardLayerStyle(open)} aria-hidden={!open}>
          {children}
        </div>
      </div>
    </div>
  );
};
