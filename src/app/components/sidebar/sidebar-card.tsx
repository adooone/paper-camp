import { Card } from '@dendelion/paper-ui';
import { surface } from '@dendelion/paper-ui/tokens';
import type { ReactNode } from 'react';

// A sidebar draws its own cards: only a component that has something to show
// renders one, so an empty sidebar area never leaves a blank card behind.
export const SidebarCard = ({ children }: { children: ReactNode }) => (
  <Card size="small" texture={surface.card} className="pc-sidebar-card shrink-0">
    {children}
  </Card>
);
