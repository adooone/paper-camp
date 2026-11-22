import { Spinner } from '@dendelion/folk-ui';
import { useStackPanel } from '@/app/hooks/use-stack-panel';
import type { StackDockState } from '../hooks/use-stack-dock';
import { Button } from '../ui/button';
import { Sheet } from '../ui/sheet';
import { AgentSection } from './agent-section';
import { DeskSection } from './desk-section';
import styles from './stack.module.css';
import { VersionFooter } from './version-footer';

function StackBody({ onClose }: { onClose?: () => void }) {
  return (
    <>
      {onClose ? (
        <div className={styles.head}>
          <Button label="Close" variant="secondary" size="xs" onPress={onClose} />
        </div>
      ) : null}
      <div className={styles.scroll}>
        <AgentSection />
        <DeskSection />
      </div>
      <VersionFooter />
    </>
  );
}

export function StackPanel({ dock }: { dock: StackDockState }) {
  const { panelRef, agentActive } = useStackPanel(dock.open, dock.docked, dock.hide);
  return (
    <>
      {dock.docked ? (
        <aside ref={panelRef} aria-label="Stack" className={`${styles.dock} ${styles.board}`}>
          <StackBody />
        </aside>
      ) : (
        <>
          {dock.open ? null : (
            <button
              type="button"
              aria-label={agentActive ? 'Open stack panel — agent running' : 'Open stack panel'}
              onClick={dock.show}
              className={agentActive ? `${styles.tab} ${styles.tabActive}` : styles.tab}
            >
              {agentActive ? <Spinner size="small" label="Agent running" /> : 'S'}
            </button>
          )}
          <Sheet visible={dock.open} onRequestClose={dock.hide} chalk label="Stack">
            <StackBody onClose={dock.hide} />
          </Sheet>
        </>
      )}
    </>
  );
}
