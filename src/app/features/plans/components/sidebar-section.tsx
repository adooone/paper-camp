import type { ReactNode } from 'react';

interface SidebarSectionProps {
  label: string;
  children: ReactNode;
  action?: ReactNode;
}

export const SidebarSection = ({ label, children, action }: SidebarSectionProps) => {
  return (
    <div className="mb-5">
      <div className="flex items-center justify-between mb-[0.35rem] px-3">
        <span className="font-handwritten text-xs font-semibold leading-none opacity-[0.45]">
          {label}
        </span>
        {action}
      </div>
      {children}
    </div>
  );
};
