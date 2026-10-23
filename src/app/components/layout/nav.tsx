import { Stamp } from '@dendelion/folk-ui';

export const HUB_PATH = '/projects';
export const HUB_PATHS: string[] = [HUB_PATH];

export const navItems = [
  { id: 'plans', label: 'Ideas', path: '/' },
  { id: 'activity', label: 'Activity', path: '/activity' },
  { id: 'chat', label: 'Chat', path: '/chat' },
  { id: 'project', label: 'Project', path: '/project' },
];

export const NavLabel = ({
  item,
  chatUnansweredCount = 0,
}: {
  item: (typeof navItems)[number];
  chatUnansweredCount?: number;
}) => (
  <span className="inline-flex items-center gap-1.5">
    {item.label}
    {item.id === 'chat' && chatUnansweredCount > 0 && (
      <Stamp size="small" variant="warning">
        {chatUnansweredCount}
      </Stamp>
    )}
  </span>
);

export const SIDEBAR_WIDTH = 224;
// Where the Stack stops overlaying and docks beside the page (utilities.css sets its widths).
const THREE_COLUMN_BREAKPOINT = 1199;

// Keep in sync with the min-[1199px]:pr-[var(--pc-stack-width)] wrapper (Tailwind needs a literal).
export const LARGE_SCREEN_QUERY = `(min-width: ${THREE_COLUMN_BREAKPOINT}px)`;

// Tailwind's default `lg` breakpoint, used by sidebar-shell.tsx's lg: classes.
export const SIDEBAR_BREAKPOINT_QUERY = '(min-width: 1024px)';
