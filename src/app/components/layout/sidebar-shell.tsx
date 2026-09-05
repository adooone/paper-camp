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
        // No height cap at lg+: the card scrolls with the page, not the drawer.
        role={mobileOpen ? 'dialog' : undefined}
        aria-modal={mobileOpen || undefined}
        aria-label="Sidebar navigation"
        tabIndex={-1}
        className={`fixed inset-y-0 left-0 z-[300] w-[224px] shrink-0 overflow-y-auto lg:sticky lg:inset-auto lg:top-0 lg:z-auto lg:overflow-visible lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        } ${
          mobileOpen
            ? 'bg-[var(--pui-bg-base)] shadow-[2px_0_12px_rgba(0,0,0,0.15)]'
            : 'bg-transparent'
        }`}
      >
        <Card size="small" texture="kraft" className="mt-8">
          <div key={routeKey}>{children}</div>
        </Card>
      </aside>
    </>
  );
};
