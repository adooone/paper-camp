import { Card } from '@dendelion/paper-ui';
import type { ReactNode } from 'react';

// A sidebar draws its own cards: only a component that has something to show
// renders one, so an empty sidebar area never leaves a blank card behind.
export const SidebarCard = ({ children }: { children: ReactNode }) => (
  <Card
    size="small"
    texture={{ texture: 'parchment', shade: true }}
    className="pc-sidebar-card shrink-0"
  >
    {children}
  </Card>
);
