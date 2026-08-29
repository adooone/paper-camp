export const HUB_PATH = '/projects';
export const HUB_PATHS: string[] = [
  HUB_PATH,
  '/projects/reviews',
  '/projects/activity',
  '/projects/ideas',
];

export const navItems = [
  { id: 'plans', label: 'Plans', path: '/' },
  { id: 'roadmap', label: 'Roadmap', path: '/roadmap' },
  { id: 'docs', label: 'Docs', path: '/docs' },
  { id: 'issues', label: 'Issues', path: '/issues' },
  { id: 'stats', label: 'Stats', path: '/stats' },
  { id: 'settings', label: 'Settings', path: '/settings' },
];

export const NavLabel = ({ item }: { item: (typeof navItems)[number] }) => (
  <span className="inline-flex items-center gap-1.5">{item.label}</span>
);

export const SidebarToggleIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden="true"
  >
    <path d="M3 5h14M3 10h14M3 15h14" strokeLinecap="round" />
  </svg>
);

export const SIDEBAR_WIDTH = 224;
export const STACK_WIDTH = 480;
export const MIN_READABLE_PAGE_WIDTH = 495;
export const THREE_COLUMN_BREAKPOINT = SIDEBAR_WIDTH + MIN_READABLE_PAGE_WIDTH + STACK_WIDTH;

// Keep in sync with the min-[1199px]:pr-[var(--pc-stack-width)] wrapper (Tailwind needs a literal).
export const LARGE_SCREEN_QUERY = `(min-width: ${THREE_COLUMN_BREAKPOINT}px)`;
