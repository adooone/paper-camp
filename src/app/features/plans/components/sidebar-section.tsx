import type { ReactNode } from 'react';

interface SidebarSectionProps {
  label: string;
  children: ReactNode;
  action?: ReactNode;
}

export const SidebarSection = ({ label, children, action }: SidebarSectionProps) => {
  return (
    <div>
      <div className="pc-row-label justify-between">
        <span className="font-handwritten text-xs font-semibold opacity-[0.45]">{label}</span>
        {action}
      </div>
      {children}
    </div>
  );
};
