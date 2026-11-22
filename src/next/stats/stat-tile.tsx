import type { StatTile as StatTileModel } from '../shell/stats-model';
import { Hand } from '../ui/hand';
import { KraftCard } from '../ui/kraft-card';
import { Stamp } from '../ui/stamp';
import styles from './stats.module.css';

export function StatTile({ tile }: { tile: StatTileModel }) {
  return (
    <KraftCard>
      <div className={styles.tile}>
        <div className={styles.tileHead}>
          <Hand size="sm" bold color="inkSoft" className={styles.title}>
            {tile.title}
          </Hand>
          {tile.stamp ? <Stamp meaning={tile.stamp.meaning}>{tile.stamp.label}</Stamp> : null}
        </div>
        {tile.figure ? (
          <div className={styles.figure}>
            <Hand size="2xl" font="mono" bold>
              {tile.figure}
            </Hand>
            {tile.figureLabel ? (
              <Hand size="xs" color="inkFaint">
                {tile.figureLabel}
              </Hand>
            ) : null}
          </div>
        ) : null}
        {tile.lines.map((line) => (
          <div key={line.label} className={styles.line}>
            <div className={styles.lineMain}>
              <Hand size="sm" color="inkSoft">
                {line.label}
              </Hand>
              {line.meaning ? (
                <Stamp meaning={line.meaning}>{line.value}</Stamp>
              ) : (
                <Hand size="sm" font="mono" bold>
                  {line.value}
                </Hand>
              )}
            </div>
            {line.detail ? (
              <Hand size="xs" color="inkFaint">
                {line.detail}
              </Hand>
            ) : null}
          </div>
        ))}
        {tile.empty ? (
          <Hand size="sm" color="inkSoft">
            {tile.empty}
          </Hand>
        ) : null}
      </div>
    </KraftCard>
  );
}
