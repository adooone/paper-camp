import { crossfadeTransition, crossfadeVariants } from '@/app/styles/motion';
import { layout, space } from '@/app/styles/tokens';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
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
  const shouldReduceMotion = useReducedMotion();
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
          className="lg:hidden fixed inset-0 z-[290] cursor-default border-none p-0"
          style={{ background: 'rgba(26, 25, 23, 0.4)', backdropFilter: 'blur(4px)' }}
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
        className={`fixed inset-y-0 left-0 z-[300] transition-transform duration-300 ease-out lg:sticky lg:inset-auto lg:top-0 lg:z-auto lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{
          width: layout.sidebarWidth,
          flexShrink: 0,
          // `100%` alone would make the sticky sidebar page-height and scroll away;
          // --pc-sidebar-h caps it to the gap between the fixed chrome. `100%` stays
          // the fallback for the mobile drawer, which wants full height.
          height: 'var(--pc-sidebar-h, 100%)',
          display: 'flex',
          flexDirection: 'column',
          background: mobileOpen ? 'var(--pui-bg-base)' : 'transparent',
          boxShadow: mobileOpen ? '2px 0 12px rgba(0,0,0,0.15)' : undefined,
          overflow: 'hidden',
        }}
      >
        <div style={{ flex: 1, overflowY: 'auto', paddingTop: space[5], position: 'relative' }}>
          <AnimatePresence>
            <motion.div
              key={routeKey}
              {...crossfadeVariants(shouldReduceMotion)}
              transition={crossfadeTransition(shouldReduceMotion)}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </div>
      </aside>
    </>
  );
};
