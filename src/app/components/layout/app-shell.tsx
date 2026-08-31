import {
  ProjectSwitcher,
  RuntimeUnavailable,
  ServerReloadBanner,
  SidebarShell,
  StackPanel,
  StatusBar,
} from '@/app/components';
import { PageBreadcrumb } from '@/app/components/page-breadcrumb';
import { HubShell } from '@/app/features/hub';
import { PlanActionsColumn, PlanFilterColumn } from '@/app/features/plans/index';
import { useAppShell } from '@/app/hooks/use-app-shell';
import {
  Button,
  IconButton,
  Layout,
  Page,
  ToastProvider,
  getSurfaceStyles,
} from '@dendelion/paper-ui';
import { Outlet } from '@tanstack/react-router';
import { Suspense, lazy } from 'react';
import { NavLabel, SidebarToggleIcon, navItems } from './nav';

const DocsSidebar = lazy(() =>
  import('@/app/features/docs/index').then((m) => ({ default: m.DocsSidebar })),
);
const SettingsSidebar = lazy(() =>
  import('@/app/features/settings/index').then((m) => ({ default: m.SettingsSidebar })),
);
const RoadmapSidebar = lazy(() =>
  import('@/app/features/roadmap/index').then((m) => ({ default: m.RoadmapSidebar })),
);
const GitFileList = lazy(() =>
  import('@/app/features/git/index').then((m) => ({ default: m.GitFileList })),
);

export const AppShell = () => {
  const {
    navigate,
    activeLayer,
    readiness,
    activeId,
    hasSidebar,
    sidebarAreaKey,
    isPlansArea,
    isDocsArea,
    isSettingsArea,
    isRoadmapArea,
    isGitArea,
    isInHub,
    stackOpen,
    toggleStack,
    isLarge,
    mobileSidebarOpen,
    openMobileSidebar,
    closeMobileSidebar,
  } = useAppShell();

  // The hub is a level above the project, so it takes the whole window instead of
  // the project chrome — cross-project views compose several projects at once.
  if (isInHub) {
    return (
      <ToastProvider position="bottom-left">
        <HubShell>
          <Outlet />
        </HubShell>
      </ToastProvider>
    );
  }

  return (
    <ToastProvider position="bottom-left">
      <div className="h-screen box-border flex flex-col">
        {/* Only the chrome reserves the Stack's width — the columns below run full
            width so the parchment passes under the panel instead of stopping at it. */}
        <div className="shrink-0 min-[1199px]:pr-[var(--pc-stack-width)]">
          <ServerReloadBanner />
          {/* Full-bleed app bar: identity at the left edge, nav at the right, spanning
              the sidebar and the sheet instead of sitting inside the content column. */}
          <header
            className="pc-app-header flex items-center gap-3 h-[var(--pc-header-h)] max-[480px]:hidden"
            style={getSurfaceStyles({ texture: 'parchment', shade: true })}
          >
            {hasSidebar && (
              <IconButton
                variant="ghost"
                size="small"
                className="lg:hidden"
                label="Open sidebar"
                onClick={openMobileSidebar}
                icon={<SidebarToggleIcon />}
              />
            )}
            <ProjectSwitcher />
            <nav aria-label="Main navigation" className="flex items-center gap-1 ml-auto">
              {navItems.map((item) => (
                <Button
                  key={item.id}
                  variant="ghost"
                  size="small"
                  isActive={item.id === activeId}
                  onClick={() => navigate({ to: item.path })}
                  aria-current={item.id === activeId ? 'page' : undefined}
                >
                  <NavLabel item={item} />
                </Button>
              ))}
            </nav>
          </header>
          {/* Ambient status sits under the app bar: a rail belonging to the chrome
              above the work surface, not a band competing with it for the top edge. */}
          <StatusBar />
        </div>
        <Layout
          style={{ flex: '1 1 0%', minHeight: 0, height: 'auto' }}
          background={{ texture: 'parchment' }}
          showHeader={false}
          showSidebar={false}
          showPage={false}
          bleedBottom
        >
          <div className="flex flex-col h-full min-h-0">
            <div className="flex flex-1 min-h-0 justify-center items-start box-border overflow-y-auto [scrollbar-gutter:stable] -mt-8 -ml-8 -mr-8 pt-0 pl-8 pr-8 pb-[var(--pc-content-pad-bottom)]">
              <div className="flex min-w-0 justify-center lg:[--pc-sidebar-h:calc(100vh-160px)] gap-6 w-full min-h-full">
                {hasSidebar && (
                  <SidebarShell
                    routeKey={sidebarAreaKey}
                    mobileOpen={mobileSidebarOpen}
                    onMobileClose={closeMobileSidebar}
                  >
                    {isPlansArea && (
                      <>
                        <PlanFilterColumn />
                        <PlanActionsColumn />
                      </>
                    )}
                    {isDocsArea && (
                      <Suspense fallback={null}>
                        <DocsSidebar />
                      </Suspense>
                    )}
                    {isSettingsArea && (
                      <Suspense fallback={null}>
                        <SettingsSidebar />
                      </Suspense>
                    )}
                    {isRoadmapArea && (
                      <Suspense fallback={null}>
                        <RoadmapSidebar />
                      </Suspense>
                    )}
                    {isGitArea && (
                      <Suspense fallback={null}>
                        <GitFileList />
                      </Suspense>
                    )}
                  </SidebarShell>
                )}
                <div className="relative flex flex-col min-w-0 flex-[1_1_0%]">
                  {/* Its own band above the sheet, not a pill floating on it — `shade` is
                      the same parchment grain one step darker, reading as one folded surface. */}
                  <div className="flex flex-col flex-1 min-w-0">
                    {/* width is load-bearing: `.page`'s `margin: 0 auto` suppresses flex
                        stretch, so without it the sheet sizes to its content. */}
                    <Page
                      texture={{ texture: 'paper', shade: true }}
                      rounded="none"
                      className="pc-page w-full max-w-none"
                    >
                      {readiness === 'unreachable' ? (
                        <RuntimeUnavailable layer={activeLayer} />
                      ) : readiness === 'checking' ? null : (
                        <Suspense fallback={null}>
                          <PageBreadcrumb />
                          <Outlet />
                        </Suspense>
                      )}
                    </Page>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Layout>
      </div>
      <StackPanel open={stackOpen} pinned={isLarge} onToggle={toggleStack} />
      {/* Header's nav row (max-[480px]:hidden above) has nowhere to wrap below the
          phone breakpoint — this fixed bottom bar replaces it, reachable one-handed. */}
      <nav
        aria-label="Main navigation"
        className="hidden max-[480px]:flex max-[480px]:fixed max-[480px]:left-0 max-[480px]:right-0 max-[480px]:bottom-0 max-[480px]:z-[250] max-[480px]:items-stretch max-[480px]:justify-around max-[480px]:gap-1 max-[480px]:py-2 max-[480px]:px-2 max-[480px]:[padding-bottom:calc(0.5rem+env(safe-area-inset-bottom))] max-[480px]:bg-[var(--pui-bg-base,#fff)] max-[480px]:border-t max-[480px]:border-black/10 max-[480px]:shadow-[0_-2px_8px_rgba(0,0,0,0.08)]"
      >
        {hasSidebar && (
          <IconButton
            variant="ghost"
            size="small"
            label="Open sidebar"
            onClick={openMobileSidebar}
            icon={<SidebarToggleIcon />}
            className="min-h-11"
          />
        )}
        {navItems.map((item) => (
          <Button
            key={item.id}
            variant="ghost"
            size="small"
            isActive={item.id === activeId}
            onClick={() => navigate({ to: item.path })}
            aria-current={item.id === activeId ? 'page' : undefined}
            className="min-h-11"
          >
            <NavLabel item={item} />
          </Button>
        ))}
      </nav>
    </ToastProvider>
  );
};
