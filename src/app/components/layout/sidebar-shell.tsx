import { Drawer } from '@dendelion/paper-ui';
import { SIDEBAR_WIDTH } from './nav';

interface SidebarShellProps {
  routeKey: string;
  children: React.ReactNode;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export const SidebarShell = ({
  routeKey,
  children,
  mobileOpen,
  onMobileClose,
}: SidebarShellProps) => (
  <>
    <aside
      aria-label="Sidebar navigation"
      // `self-start`: a row-stretched flex item is already full height, so sticky can't
      // engage; sizing to content lets it pin while the page scrolls.
      className="hidden w-[224px] shrink-0 overflow-y-auto lg:flex lg:sticky lg:top-0 lg:max-h-[calc(100dvh-var(--pc-header-h)-32px)] lg:flex-col lg:self-start lg:overflow-visible"
    >
      <div key={routeKey} className="mt-8 mb-8 flex min-h-0 flex-col gap-8 overflow-y-auto">
        {children}
      </div>
    </aside>
    <Drawer open={mobileOpen} onClose={onMobileClose} side="left" width={SIDEBAR_WIDTH}>
      <div key={routeKey} className="flex min-h-0 flex-col gap-8 overflow-y-auto">
        {children}
      </div>
    </Drawer>
  </>
);
