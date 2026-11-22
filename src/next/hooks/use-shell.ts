import { useNavigate, useRouterState } from '@tanstack/react-router';
import { useState } from 'react';
import { useMediaQuery } from '@/app/hooks/use-media-query';
import { HUB_DESK_PATH } from '@/app/services/desk-links';
import { openDesk } from '../shell/open-desk';
import {
  SCREEN_PATHS,
  SCREEN_TITLES,
  type Screen,
  screenOf,
  type TabId,
  tabOf,
  WIDE_QUERY,
} from '../shell/screens';
import { useProjectName } from './use-project-name';
import { useProjectState } from './use-project-state';
import { type ProjectSwitcherState, useProjectSwitcher } from './use-project-switcher';
import { useLogSnapshot } from './use-runs-snapshot';

export interface ShellState {
  title: string;
  stamp: string | undefined;
  projectName: string | null;
  tab: TabId;
  wide: boolean;
  split: boolean;
  switcherOpen: boolean;
  openSwitcher: () => void;
  closeSwitcher: () => void;
  selectTab: (tab: TabId) => void;
  addMachine: () => void;
  switcher: ProjectSwitcherState;
}

export function useShell(): ShellState {
  useProjectState();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const navigate = useNavigate();
  const wide = useMediaQuery(WIDE_QUERY);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const projectName = useProjectName();
  const switcher = useProjectSwitcher();
  const { unreadCount } = useLogSnapshot();
  const screen: Screen = screenOf(pathname);
  return {
    title: SCREEN_TITLES[screen],
    stamp: screen === 'log' && unreadCount > 0 ? `${unreadCount} unread` : undefined,
    projectName,
    tab: tabOf(screen),
    wide,
    split: screen === 'ideas' || screen === 'log',
    switcherOpen,
    openSwitcher: () => setSwitcherOpen(true),
    closeSwitcher: () => setSwitcherOpen(false),
    selectTab: (tab) => void navigate({ to: SCREEN_PATHS[tab] }),
    addMachine: () => openDesk(HUB_DESK_PATH),
    switcher,
  };
}
