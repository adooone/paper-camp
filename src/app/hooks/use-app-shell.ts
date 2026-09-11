import { HUB_PATHS, LARGE_SCREEN_QUERY, navItems } from '@/app/components/layout/nav';
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

export interface AppShellState {
  navigate: ReturnType<typeof useNavigate>;
  pathname: string;
  activeLayer: ModuleLayer | undefined;
  readiness: ReturnType<typeof moduleReadiness>;
  activeId: string | undefined;
  hasSidebar: boolean;
  sidebarAreaKey: string;
  isPlansArea: boolean;
  isDocsArea: boolean;
  isSettingsArea: boolean;
  isRoadmapArea: boolean;
  isGitArea: boolean;
  isLogArea: boolean;
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
  const isPlansArea =
    pathname === '/' || pathname.startsWith('/plans/') || pathname.startsWith('/ideas/');
  const isDocsArea = pathname === '/docs' || pathname.startsWith('/docs/');
  const isSettingsArea = pathname === '/settings' || pathname.startsWith('/settings/');
  const isRoadmapArea = pathname === '/roadmap';
  const isGitArea = pathname === '/git';
  const isLogArea = pathname === '/log' || pathname.startsWith('/log/');
  const activeId = isPlansArea
    ? 'plans'
    : isDocsArea
      ? 'docs'
      : isSettingsArea
        ? 'settings'
        : navItems.find((item) => item.path === pathname)?.id;
  const hasSidebar =
    isPlansArea || isDocsArea || isSettingsArea || isRoadmapArea || isGitArea || isLogArea;
  const sidebarAreaKey = isPlansArea
    ? 'plans'
    : isDocsArea
      ? 'docs'
      : isSettingsArea
        ? 'settings'
        : isRoadmapArea
          ? 'roadmap'
          : isGitArea
            ? 'git'
            : 'log';
  const [stackOpen, setStackOpen] = useState(readStoredStackOpen);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const isLarge = useMediaQuery(LARGE_SCREEN_QUERY);
  const firstRunChecked = useRef(false);

  useNotificationPush();

  useEffect(() => {
    loadSuggestions();
    loadNightReport();
    loadCapabilities();
    loadAgentAuthStatus();
    loadParkedQuestions();
    loadNotifications();
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
    checkRuntimeReachable,
    loadPlans,
    loadIdeas,
  ]);

  // A corpus at or below `init`'s single seeded example idea (IDEA-1, no plans yet)
  // hasn't been used for real work — point it at USAGE.md instead of an empty Ideas list.
  useEffect(() => {
    if (firstRunChecked.current || pathname !== '/') return;
    firstRunChecked.current = true;
    Promise.all([fetchIdeas(), fetchPlans()])
      .then(([ideas, plans]) => {
        if ((ideas.entries?.length ?? 0) > 1 || (plans.entries?.length ?? 0) > 0) return;
        setActiveDocTitle('USAGE.md');
        navigate({ to: '/docs' });
      })
      .catch(() => {});
  }, [pathname, navigate, setActiveDocTitle]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: pathname is the trigger, not a value read in the body.
  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [pathname]);

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
    isDocsArea,
    isSettingsArea,
    isRoadmapArea,
    isGitArea,
    isLogArea,
    isInHub: HUB_PATHS.includes(pathname),
    stackOpen,
    toggleStack,
    isLarge,
    mobileSidebarOpen,
    openMobileSidebar: () => setMobileSidebarOpen(true),
    closeMobileSidebar: () => setMobileSidebarOpen(false),
  };
}
