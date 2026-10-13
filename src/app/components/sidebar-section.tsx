import { Divider } from '@dendelion/paper-ui';
import type { ReactNode } from 'react';

/** One part of a sidebar's single card. The divider above it only shows when another
 *  section comes first, so a section that renders nothing leaves no stray line. */
export const SidebarSection = ({ children }: { children: ReactNode }) => (
  <section className="flex flex-col [&:first-child>.pc-sidebar-divider]:hidden">
    <div className="pc-sidebar-divider py-2">
      <Divider sketch />
    </div>
    {children}
  </section>
);
