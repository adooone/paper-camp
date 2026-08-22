import { PageTitle } from '@/app/components/page-title';
import { Layout, Page } from '@dendelion/paper-ui';
import type { ReactNode } from 'react';

export const HubShell = ({ children }: { children?: ReactNode }) => (
  <Layout
    background={{ texture: 'speckle', ruledType: 'grid', ruledColor: 'blue' }}
    showHeader={false}
    showSidebar={false}
    showPage={false}
    bleedBottom
  >
    <div className="flex min-h-screen flex-col items-center justify-center px-6 py-16">
      <Page texture={{ texture: 'parchment' }} className="w-full max-w-lg">
        <PageTitle>Paper Camp</PageTitle>
        {children}
      </Page>
    </div>
  </Layout>
);
