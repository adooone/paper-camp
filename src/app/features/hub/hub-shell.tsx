import { Layout } from '@dendelion/paper-ui';
import type { ReactNode } from 'react';

export interface HubShellProps {
  children?: ReactNode;
}

// No Page here: the hub paints its own sheet around the project list and leaves the
// numbers column on the grid, so the two read as a sheet on a desk, not one slab.
export const HubShell = ({ children }: HubShellProps) => (
  <Layout
    background={{ texture: 'speckle', ruledType: 'grid', ruledColor: 'blue' }}
    showHeader={false}
    showSidebar={false}
    showPage={false}
    bleedBottom
  >
    <div className="h-full overflow-y-auto px-6 py-16">
      <div className="m-auto w-full max-w-4xl">{children}</div>
    </div>
  </Layout>
);
