import type { CSSProperties, ReactNode } from 'react';

const linkStyle: CSSProperties = {
  background: 'none',
  border: 'none',
  padding: 0,
  cursor: 'pointer',
  // Inherit the surface's text colour (chalk on chalkboard cards, ink on
  // paper) — a hardcoded ink colour disappears on the dark surfaces.
  color: 'inherit',
  textDecoration: 'underline',
  fontSize: '0.75rem',
};

export interface ToolbarLinkProps {
  onClick: () => void;
  children: ReactNode;
}

export const ToolbarLink = ({ onClick, children }: ToolbarLinkProps) => (
  <button type="button" style={linkStyle} onClick={onClick}>
    {children}
  </button>
);
