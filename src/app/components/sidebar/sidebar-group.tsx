import { Divider } from '@dendelion/paper-ui';
import type { ReactNode } from 'react';

export const SidebarGroup = ({ children }: { children: ReactNode }) => (
  <div className="pc-sidebar-group shrink-0 px-4">
    <Divider sketch className="pc-sidebar-group-rule mb-3" />
    {children}
  </div>
);
