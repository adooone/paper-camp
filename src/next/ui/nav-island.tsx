import type { ReactNode } from 'react';
import { Hand } from './hand';
import styles from './nav-island.module.css';

interface NavIslandTab {
  id: string;
  label: string;
  icon: ReactNode;
}

interface NavIslandProps {
  tabs: NavIslandTab[];
  current: string;
  onSelect: (id: string) => void;
  docked?: boolean;
}

// folk-ui's Tabs and Island are a ruled strip; the phone's navigation is a floating kraft pill.
export function NavIsland({ tabs, current, onSelect, docked = true }: NavIslandProps) {
  const island = (
    <nav className={styles.island}>
      {tabs.map((tab) => {
        const active = tab.id === current;
        return (
          <button
            key={tab.id}
            type="button"
            aria-current={active ? 'page' : undefined}
            onClick={() => onSelect(tab.id)}
            className={active ? `${styles.tab} ${styles.tabActive}` : styles.tab}
          >
            <span className={styles.icon} aria-hidden="true">
              {tab.icon}
            </span>
            <Hand size="xs" bold color={active ? 'sketchInk' : 'canvas700'}>
              {tab.label}
            </Hand>
          </button>
        );
      })}
    </nav>
  );
  return docked ? <div className={styles.dock}>{island}</div> : island;
}
