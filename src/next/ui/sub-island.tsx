import { Hand } from './hand';
import styles from './sub-island.module.css';

interface SubIslandSegment {
  id: string;
  label: string;
  count?: number;
}

interface SubIslandProps {
  segments: SubIslandSegment[];
  current: string;
  onSelect: (id: string) => void;
  bottomSpace: number;
  docked?: boolean;
}

const ISLAND_GAP = 12;

// folk-ui's Tabs underline the active tab; the phone's segments are pills on a white sheet.
export function SubIsland({
  segments,
  current,
  onSelect,
  bottomSpace,
  docked = true,
}: SubIslandProps) {
  const sheet = (
    <div className={styles.sheet} style={{ paddingBottom: bottomSpace + ISLAND_GAP }}>
      <div className={styles.row} role="tablist">
        {segments.map((segment) => {
          const active = segment.id === current;
          return (
            <button
              key={segment.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onSelect(segment.id)}
              className={active ? `${styles.segment} ${styles.segmentActive}` : styles.segment}
            >
              <Hand size="xs" bold color={active ? 'sketchInk' : 'canvas700'}>
                {segment.count != null ? `${segment.label} · ${segment.count}` : segment.label}
              </Hand>
            </button>
          );
        })}
      </div>
    </div>
  );
  return docked ? <div className={styles.dock}>{sheet}</div> : sheet;
}
