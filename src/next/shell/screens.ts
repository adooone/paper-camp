export type Screen = 'projects' | 'ideas' | 'chat' | 'settings' | 'log' | 'git';

export type TabId = 'projects' | 'ideas' | 'chat' | 'settings';

export const WIDE_QUERY = '(min-width: 1024px)';

export const SCREEN_PATHS: Record<Screen, string> = {
  projects: '/',
  ideas: '/ideas',
  chat: '/chat',
  settings: '/settings',
  log: '/log',
  git: '/git',
};

export const SCREEN_TITLES: Record<Screen, string> = {
  projects: 'Projects',
  ideas: 'Ideas',
  chat: 'Chat',
  settings: 'Settings',
  log: 'Log',
  git: 'Git',
};

const SCREEN_TAB: Record<Screen, TabId> = {
  projects: 'projects',
  ideas: 'ideas',
  chat: 'chat',
  settings: 'settings',
  log: 'projects',
  git: 'projects',
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
