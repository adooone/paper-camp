import { useStackPanel } from '@/app/hooks/use-stack-panel';
import { IconButton, Spinner } from '@dendelion/paper-ui';
import { AgentSection } from './agent-section';
import { DeskSection } from './desk-section';

interface StackPanelProps {
  open: boolean;
  onToggle: () => void;
  // When pinned, the reopen handle and close button are both hidden.
  pinned?: boolean;
}

export const StackPanel = ({ open, onToggle, pinned = false }: StackPanelProps) => {
  const isOpen = open || pinned;
  const { panelRef, anyChecksFailing, agentActive } = useStackPanel(isOpen, pinned, onToggle);

  return (
    <>
      {!isOpen && (
        <div
          // var() so utilities.css can nudge it toward one-handed thumb reach below the
          // phone breakpoint.
          className="fixed right-0 top-[var(--pc-stack-toggle-top,50%)] z-[300] rounded-l-md shadow-[-2px_0_8px_rgba(0,0,0,0.15)] bg-desk-bg bg-chalkboard [background-repeat:repeat,no-repeat] [background-size:200px_200px,auto]"
          style={{ transform: 'translateY(-50%)' }}
        >
          <IconButton
            icon={
              agentActive ? (
                <Spinner size="small" surface="chalkboard" label="Agent running" />
              ) : anyChecksFailing ? (
                <span
                  aria-hidden="true"
                  className="h-2 w-2 rounded-full bg-chalk-fail-text shadow-[0_0_6px_rgba(214,160,160,0.9)]"
                />
              ) : (
                <span className="text-2xs">S</span>
              )
            }
            surface="chalkboard"
            size="small"
            label={
              agentActive
                ? 'Open stack panel — agent running'
                : anyChecksFailing
                  ? 'Open stack panel — checks failing'
                  : 'Open stack panel'
            }
            onClick={onToggle}
            className={`w-7 h-[64px] rounded-l-md ${
              agentActive
                ? 'shadow-[inset_0_0_0_1px_rgba(214,196,160,0.6)]'
                : anyChecksFailing
                  ? 'shadow-[inset_0_0_0_1px_rgba(214,160,160,0.6)]'
                  : ''
            }`}
          />
        </div>
      )}
      <aside
        ref={panelRef}
        // Below the phone breakpoint the docked width would overflow the viewport itself.
        // Above the Layout header (z-200) — the panel owns the full right edge.
        aria-label="Stack"
        className="fixed inset-y-0 right-0 z-[300] flex w-[min(var(--pc-stack-width),100vw)] flex-col overflow-hidden border-l-4 border-paper-950/[12%] text-desk-text bg-desk-bg bg-chalkboard [background-repeat:repeat,no-repeat] [background-size:200px_200px,auto]"
        style={{ transform: isOpen ? 'translateX(0)' : 'translateX(100%)' }}
      >
        {!pinned && (
          <div className="flex h-10 shrink-0 items-center justify-end px-[var(--pc-stack-pad)]">
            <IconButton
              icon={<span className="text-sm leading-none">&times;</span>}
              surface="chalkboard"
              size="small"
              label="Close stack panel"
              onClick={onToggle}
              className="h-7 w-7 border border-desk-border"
            />
          </div>
        )}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <AgentSection />
          <DeskSection />
        </div>
      </aside>
    </>
  );
};
