import { PageTitle } from '@/app/components/page-title';
import { Layout, Page } from '@dendelion/paper-ui';
import type { ReactNode } from 'react';

export interface HubShellProps {
  children?: ReactNode;
}

export const HubShell = ({ children }: HubShellProps) => (
  <Layout
    background={{ texture: 'speckle', ruledType: 'grid', ruledColor: 'blue' }}
    showHeader={false}
    showSidebar={false}
    showPage={false}
    bleedBottom
  >
    <div className="h-full overflow-y-auto px-6 py-16">
      <Page texture={{ texture: 'parchment' }} className="m-auto w-full max-w-3xl">
        <PageTitle>Paper Camp</PageTitle>
        {children}
      </Page>
    </div>
  </Layout>
);
