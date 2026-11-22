export type Screen =
  | 'projects'
  | 'ideas'
  | 'chat'
  | 'settings'
  | 'log'
  | 'git'
  | 'roadmap'
  | 'stats'
  | 'diff'
  | 'docs'
  | 'night'
  | 'queue';

export type TabId = 'projects' | 'ideas' | 'chat' | 'settings';

export const WIDE_QUERY = '(min-width: 1024px)';

export const STACK_DOCK_QUERY = '(min-width: 1199px)';

export const SCREEN_PATHS: Record<Screen, string> = {
  projects: '/',
  ideas: '/ideas',
  chat: '/chat',
  settings: '/settings',
  log: '/log',
  git: '/git',
  roadmap: '/roadmap',
  stats: '/stats',
  diff: '/diff',
  docs: '/docs',
  night: '/night',
  queue: '/queue',
};

export const DESK_SETUP_PATH: string = '/settings/desk';

export const RELEASES_PATH: string = '/docs/releases';

export const docPath = (name: string): string => `${SCREEN_PATHS.docs}/${encodeURIComponent(name)}`;

export const SCREEN_TITLES: Record<Screen, string> = {
  projects: 'Projects',
  ideas: 'Ideas',
  chat: 'Chat',
  settings: 'Settings',
  log: 'Log',
  git: 'Git',
  roadmap: 'Roadmap',
  stats: 'Stats',
  diff: 'Diff',
  docs: 'Docs',
  night: 'Night report',
  queue: 'Run order',
};

const SCREEN_TAB: Record<Screen, TabId> = {
  projects: 'projects',
  ideas: 'ideas',
  chat: 'chat',
  settings: 'settings',
  log: 'projects',
  git: 'projects',
  roadmap: 'projects',
  stats: 'projects',
  diff: 'projects',
  docs: 'projects',
  night: 'projects',
  queue: 'projects',
};

export const TAB_ORDER: readonly TabId[] = ['projects', 'ideas', 'chat', 'settings'];

export function screenOf(pathname: string): Screen {
  const first = pathname.split('/').find((segment) => segment !== '') ?? '';
  const match = (Object.keys(SCREEN_PATHS) as Screen[]).find(
    (screen) => SCREEN_PATHS[screen] === `/${first}`,
  );
  return match ?? 'projects';
}

export function tabOf(screen: Screen): TabId {
  return SCREEN_TAB[screen];
}
