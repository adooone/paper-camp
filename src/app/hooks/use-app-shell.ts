import {
  HUB_PATHS,
  LARGE_SCREEN_QUERY,
  SIDEBAR_BREAKPOINT_QUERY,
  navItems,
} from '@/app/components/layout/nav';
import { fetchIdeas, fetchPlans } from '@/app/services/content';
import { rememberRoute } from '@/app/services/last-route-store';
import { type ModuleLayer, moduleReadiness } from '@/app/services/module-layer';
import { runtimeConnection } from '@/app/services/runtime-connection';
import { useAppStore } from '@/app/stores/app-store';
import { useNavigate, useRouterState } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { useMediaQuery } from './use-media-query';
import { useNotificationPush } from './use-notification-push';

const storage = typeof window === 'undefined' ? null : window.localStorage;

const STACK_OPEN_KEY = 'stack-open';

function readStoredStackOpen(): boolean {
  try {
    return localStorage.getItem(STACK_OPEN_KEY) === 'true';
  } catch {
    return false;
  }
}

function writeStoredStackOpen(value: boolean): void {
  try {
    localStorage.setItem(STACK_OPEN_KEY, String(value));
  } catch {
    // localStorage unavailable (e.g. private browsing) — fall back to in-memory only
  }
}

export function shouldShowUsageFallback(
  openedOnRoot: boolean,
  pathnameAtResolve: string,
  ideaCount: number,
  planCount: number,
): boolean {
  if (!openedOnRoot || pathnameAtResolve !== '/') return false;
  return ideaCount <= 1 && planCount === 0;
}

export interface AppShellState {
  navigate: ReturnType<typeof useNavigate>;
  pathname: string;
  activeLayer: ModuleLayer | undefined;
  readiness: ReturnType<typeof moduleReadiness>;
  activeId: string | undefined;
  hasSidebar: boolean;
  sidebarAreaKey: string;
  isPlansArea: boolean;
  isProjectArea: boolean;
  isGitArea: boolean;
  isInHub: boolean;
  stackOpen: boolean;
  toggleStack: () => void;
  isLarge: boolean;
  mobileSidebarOpen: boolean;
  openMobileSidebar: () => void;
  closeMobileSidebar: () => void;
}

export function useAppShell(): AppShellState {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const loadPlans = useAppStore((s) => s.loadPlans);
  const loadIdeas = useAppStore((s) => s.loadIdeas);
  const loadSuggestions = useAppStore((s) => s.loadSuggestions);
  const loadNightReport = useAppStore((s) => s.loadNightReport);
  const loadCapabilities = useAppStore((s) => s.loadCapabilities);
  const loadAgentAuthStatus = useAppStore((s) => s.loadAgentAuthStatus);
  const loadParkedQuestions = useAppStore((s) => s.loadParkedQuestions);
  const loadNotifications = useAppStore((s) => s.loadNotifications);
  const loadChat = useAppStore((s) => s.loadChat);
  const setActiveDocTitle = useAppStore((s) => s.setActiveDocTitle);
  const checkRuntimeReachable = useAppStore((s) => s.checkRuntimeReachable);
  const runtimeReachable = useAppStore((s) => s.runtimeReachable);
  const runtimeChecking = useAppStore((s) => s.runtimeChecking);
  const activeLayer = useRouterState({
    select: (s) => s.matches.at(-1)?.staticData.layer,
  });
  const readiness = moduleReadiness(activeLayer, {
    reachable: runtimeReachable,
    checking: runtimeChecking,
  });
  // A roadmap item still lives at `/roadmap/$item`, but it's rendered under the
  // Ideas tab now, so it counts toward the Plans area for nav and breadcrumb purposes.
  const isPlansArea =
    pathname === '/' ||
    pathname.startsWith('/plans/') ||
    pathname.startsWith('/ideas/') ||
    pathname.startsWith('/findings/') ||
    pathname.startsWith('/roadmap/');
  // Docs, Stats and Settings live together under /project (IDEA-290); the project
  // sidebar picks its own active group from the fuller path.
  const isProjectArea = pathname === '/project' || pathname.startsWith('/project/');
  // Log and Chat live together under /activity (IDEA-290); Activity has no sidebar
  // of its own, so this only feeds the header tab, not hasSidebar below.
  const isActivityArea = pathname === '/activity' || pathname.startsWith('/activity/');
  const isGitArea = pathname === '/git';
  const activeId = isPlansArea
    ? 'plans'
    : isProjectArea
      ? 'project'
      : isActivityArea
        ? 'activity'
        : navItems.find((item) => item.path === pathname)?.id;
  // List routes have no sidebar now that filters live in the toolbar;
  // only a plan/idea/finding detail still has an actions column to show.
  const hasSidebar =
    (isPlansArea && pathname !== '/' && !pathname.startsWith('/roadmap/')) ||
    isProjectArea ||
    isGitArea;
  const sidebarAreaKey = isPlansArea ? 'plans' : isProjectArea ? 'project' : 'git';
  const [stackOpen, setStackOpen] = useState(readStoredStackOpen);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const isLarge = useMediaQuery(LARGE_SCREEN_QUERY);
  const isAboveSidebarBreakpoint = useMediaQuery(SIDEBAR_BREAKPOINT_QUERY);
  const firstRunChecked = useRef(false);
  const openedOnRoot = useRef(pathname === '/');
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

  useNotificationPush();

  useEffect(() => {
    loadSuggestions();
    loadNightReport();
    loadCapabilities();
    loadAgentAuthStatus();
    loadParkedQuestions();
    loadNotifications();
    loadChat();
    checkRuntimeReachable();
    loadPlans();
    loadIdeas();
  }, [
    loadSuggestions,
    loadNightReport,
    loadCapabilities,
    loadAgentAuthStatus,
    loadParkedQuestions,
    loadNotifications,
    loadChat,
    checkRuntimeReachable,
    loadPlans,
    loadIdeas,
  ]);

  // An unused corpus (IDEA-1 only, no plans) points at USAGE.md instead of an empty
  // Ideas list; armed once at mount so a session that opened elsewhere never trips it.
  useEffect(() => {
    if (firstRunChecked.current) return;
    firstRunChecked.current = true;
    if (!openedOnRoot.current) return;
    Promise.all([fetchIdeas(), fetchPlans()])
      .then(([ideas, plans]) => {
        const shouldShow = shouldShowUsageFallback(
          openedOnRoot.current,
          pathnameRef.current,
          ideas.entries?.length ?? 0,
          plans.entries?.length ?? 0,
        );
        if (!shouldShow) return;
        setActiveDocTitle('USAGE.md');
        navigate({ to: '/project/docs' });
      })
      .catch(() => {});
  }, [navigate, setActiveDocTitle]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: pathname is the trigger, not a value read in the body.
  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [pathname]);

  // A resize past the sidebar breakpoint while the drawer is open would
  // otherwise mount the sidebar content twice.
  useEffect(() => {
    if (isAboveSidebarBreakpoint) setMobileSidebarOpen(false);
  }, [isAboveSidebarBreakpoint]);

  // The hub's own route is a project switcher, not part of any one project's
  // work, so it is never worth landing back on.
  useEffect(() => {
    if (HUB_PATHS.includes(pathname)) return;
    rememberRoute(runtimeConnection.runtimeUrl, pathname, storage);
  }, [pathname]);

  const toggleStack = () => {
    // Not a functional updater: StrictMode double-invokes those, which would
    // double-write to localStorage.
    const next = !stackOpen;
    writeStoredStackOpen(next);
    setStackOpen(next);
  };

  return {
    navigate,
    pathname,
    activeLayer,
    readiness,
    activeId,
    hasSidebar,
    sidebarAreaKey,
    isPlansArea,
    isProjectArea,
    isGitArea,
    isInHub: HUB_PATHS.includes(pathname),
    stackOpen,
    toggleStack,
    isLarge,
    mobileSidebarOpen,
    openMobileSidebar: () => setMobileSidebarOpen(true),
    closeMobileSidebar: () => setMobileSidebarOpen(false),
  };
}
