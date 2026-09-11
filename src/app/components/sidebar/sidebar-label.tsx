import type { ReactNode } from 'react';

interface SidebarLabelProps {
  children: ReactNode;
  action?: ReactNode;
}

export const SidebarLabel = ({ children, action }: SidebarLabelProps) => (
  <div className="pc-row-label justify-between">
    <span className="font-handwritten text-xs font-semibold opacity-[0.45]">{children}</span>
    {action}
  </div>
);
