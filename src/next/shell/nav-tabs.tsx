import { ChatIcon, FolderIcon, LightbulbIcon } from '@dendelion/folk-ui';
import type { ComponentProps } from 'react';
import type { NavIsland } from '../ui/nav-island';
import { SlidersIcon } from './sliders-icon';

type Tabs = ComponentProps<typeof NavIsland>['tabs'];

export const NAV_TABS: Tabs = [
  { id: 'projects', label: 'Projects', icon: <FolderIcon size={20} /> },
  { id: 'ideas', label: 'Ideas', icon: <LightbulbIcon size={20} /> },
  { id: 'chat', label: 'Chat', icon: <ChatIcon size={20} /> },
  { id: 'settings', label: 'Settings', icon: <SlidersIcon /> },
];
