export const HUB_PATH = '/projects';
export const HUB_PATHS: string[] = [HUB_PATH];

export const navItems = [
  { id: 'plans', label: 'Ideas', path: '/' },
  { id: 'activity', label: 'Activity', path: '/activity' },
  { id: 'project', label: 'Project', path: '/project' },
];

export const NavLabel = ({ item }: { item: (typeof navItems)[number] }) => (
  <span className="inline-flex items-center gap-1.5">{item.label}</span>
);

export const SIDEBAR_WIDTH = 224;
export const STACK_WIDTH = 480;
export const MIN_READABLE_PAGE_WIDTH = 495;
export const THREE_COLUMN_BREAKPOINT = SIDEBAR_WIDTH + MIN_READABLE_PAGE_WIDTH + STACK_WIDTH;

// Keep in sync with the min-[1199px]:pr-[var(--pc-stack-width)] wrapper (Tailwind needs a literal).
export const LARGE_SCREEN_QUERY = `(min-width: ${THREE_COLUMN_BREAKPOINT}px)`;

// Tailwind's default `lg` breakpoint, used by sidebar-shell.tsx's lg: classes.
export const SIDEBAR_BREAKPOINT_QUERY = '(min-width: 1024px)';
