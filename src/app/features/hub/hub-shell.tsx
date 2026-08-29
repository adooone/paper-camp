import { PageTitle } from '@/app/components/page-title';
import { Button, Layout, Page } from '@dendelion/paper-ui';
import { useNavigate, useRouterState } from '@tanstack/react-router';
import type { ReactNode } from 'react';

const TABS = [
  { path: '/projects', label: 'Projects' },
  { path: '/projects/reviews', label: 'In review' },
  { path: '/projects/activity', label: 'Agent activity' },
  { path: '/projects/ideas', label: 'Ideas' },
] as const;

export const HubShell = ({ children }: { children?: ReactNode }) => {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <Layout
      background={{ texture: 'speckle', ruledType: 'grid', ruledColor: 'blue' }}
      showHeader={false}
      showSidebar={false}
      showPage={false}
      bleedBottom
    >
      <div className="h-full overflow-y-auto px-6 py-16">
        <Page texture={{ texture: 'parchment' }} className="m-auto w-full max-w-lg">
          <PageTitle>Paper Camp</PageTitle>
          <nav aria-label="Hub navigation" className="flex flex-wrap gap-1 mb-4">
            {TABS.map((tab) => (
              <Button
                key={tab.path}
                variant="ghost"
                size="small"
                isActive={pathname === tab.path}
                onClick={() => navigate({ to: tab.path })}
                aria-current={pathname === tab.path ? 'page' : undefined}
              >
                {tab.label}
              </Button>
            ))}
          </nav>
          {children}
        </Page>
      </div>
    </Layout>
  );
};
