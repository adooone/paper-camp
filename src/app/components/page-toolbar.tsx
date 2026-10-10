import type { ReactNode } from 'react';

interface PageToolbarProps {
  children: ReactNode;
  className?: string;
}

export const PageToolbar = ({ children, className = '' }: PageToolbarProps) => (
  <div className={`flex flex-col gap-2 mb-5 ${className}`.trim()}>{children}</div>
);

interface PageToolbarRowProps {
  children: ReactNode;
  /** A chip set may break onto a second line; a row of controls never does. */
  chips?: boolean;
}

export const PageToolbarRow = ({ children, chips = false }: PageToolbarRowProps) => (
  <div
    className={
      chips
        ? 'flex flex-wrap items-center gap-x-1.5 gap-y-1 min-w-0'
        : 'flex items-center gap-2 min-w-0'
    }
  >
    {children}
  </div>
);
