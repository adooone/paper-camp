import { Card } from '@dendelion/paper-ui';
import { useEffect, useRef } from 'react';

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
}: SidebarShellProps) => {
  const asideRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!mobileOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onMobileClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileOpen, onMobileClose]);

  // Move focus into the drawer on open (it acts as a modal below lg); restore
  // focus to the hamburger trigger on close.
  useEffect(() => {
    if (!mobileOpen) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    asideRef.current?.focus();
    return () => previouslyFocused?.focus?.();
  }, [mobileOpen]);

  return (
    <>
      {/* Raw <button>: invisible backdrop — a paper-ui Button draws its own visible chrome. */}
      {mobileOpen && (
        <button
          type="button"
          className="lg:hidden fixed inset-0 z-[290] cursor-default border-none p-0 bg-ink-900/[40%] backdrop-blur-sm"
          onClick={onMobileClose}
          aria-label="Close sidebar"
          tabIndex={-1}
        />
      )}
      <aside
        ref={asideRef}
        // Dialog semantics only as a mobile drawer — at lg+ it's an in-flow sidebar.
        role={mobileOpen ? 'dialog' : undefined}
        aria-modal={mobileOpen || undefined}
        aria-label="Sidebar navigation"
        tabIndex={-1}
        // `self-start`: a row-stretched flex item is already full height, so sticky can't
        // engage; sizing to content lets it pin while the page scrolls.
        className={`fixed inset-y-0 left-0 z-[300] w-[224px] shrink-0 overflow-y-auto lg:sticky lg:inset-auto lg:top-0 lg:z-auto lg:flex lg:max-h-[calc(100dvh-var(--pc-header-h)-32px)] lg:flex-col lg:self-start lg:overflow-visible lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        } ${
          mobileOpen
            ? 'bg-[var(--pui-bg-base)] shadow-[2px_0_12px_rgba(0,0,0,0.15)]'
            : 'bg-transparent'
        }`}
      >
        <Card
          size="small"
          texture="kraft"
          className="pc-sidebar-card mt-8 mb-8 flex min-h-0 flex-col"
        >
          <div key={routeKey} className="min-h-0 flex-1 overflow-y-auto">
            {children}
          </div>
        </Card>
      </aside>
    </>
  );
};
