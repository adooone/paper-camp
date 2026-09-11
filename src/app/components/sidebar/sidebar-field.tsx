import type { ReactNode } from 'react';
import { SidebarLabel } from './sidebar-label';

interface SidebarFieldProps {
  label: string;
  children: ReactNode;
}

export const SidebarField = ({ label, children }: SidebarFieldProps) => (
  <div className="flex flex-col">
    <SidebarLabel>{label}</SidebarLabel>
    <div className="w-full [&>*]:w-full">{children}</div>
  </div>
);
