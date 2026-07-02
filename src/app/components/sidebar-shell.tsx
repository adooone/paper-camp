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

  // When the drawer opens, move focus into it (it acts as a modal dialog below
  // the lg breakpoint); restore focus to whatever was focused before — the
  // hamburger trigger — when it closes.
  useEffect(() => {
    if (!mobileOpen) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    asideRef.current?.focus();
    return () => previouslyFocused?.focus?.();
  }, [mobileOpen]);

  return (
    <>
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
        // Dialog semantics only while acting as a mobile drawer — at lg+ this is
        // an in-flow navigation sidebar, not a modal.
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
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: mobileOpen ? 'var(--pui-bg-base)' : 'transparent',
          boxShadow: mobileOpen ? '2px 0 12px rgba(0,0,0,0.15)' : undefined,
          overflow: 'hidden',
        }}
      >
        <div style={{ flex: 1, overflowY: 'auto', paddingTop: space[5], position: 'relative' }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={routeKey}
              initial={shouldReduceMotion ? undefined : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={shouldReduceMotion ? undefined : { opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </div>
      </aside>
    </>
  );
};
