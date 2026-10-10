import type { ReactNode } from 'react';

interface PageToolbarProps {
  children: ReactNode;
  className?: string;
}

export const PageToolbar = ({ children, className = '' }: PageToolbarProps) => (
  <div className={`flex items-center gap-2 flex-wrap mb-6 ${className}`.trim()}>{children}</div>
);
