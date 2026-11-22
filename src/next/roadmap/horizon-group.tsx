import { useState } from 'react';
import type { ResolvedRoadmapHorizon } from '@/types/index';
import { horizonSummary, rollupFigure } from '../shell/roadmap-model';
import { Hand } from '../ui/hand';
import { ListLabel } from '../ui/list';
import { Stamp } from '../ui/stamp';
import { ItemRow } from './item-row';
import styles from './roadmap.module.css';

interface HorizonGroupProps {
  horizon: ResolvedRoadmapHorizon;
}

export function HorizonGroup({ horizon }: HorizonGroupProps) {
  const [shippedOpen, setShippedOpen] = useState(false);
  const open = horizon.items.filter((item) => item.state !== 'shipped');
  const shipped = horizon.items.filter((item) => item.state === 'shipped');
  return (
    <div className={styles.group}>
      <ListLabel trailing={<Stamp meaning="idle">{rollupFigure(horizon.rollup)}</Stamp>}>
        {horizon.title}
      </ListLabel>
      <div className={styles.note}>
        {horizon.intro ? (
          <Hand size="sm" color="inkSoft">
            {horizon.intro}
          </Hand>
        ) : null}
        <Hand size="xs" color="inkFaint">
          {horizonSummary(horizon)}
        </Hand>
      </div>
      {horizon.items.length === 0 ? (
        <div className={styles.note}>
          <Hand size="sm" color="inkSoft">
            Nothing here matches.
          </Hand>
        </div>
      ) : null}
      {open.map((item) => (
        <ItemRow key={item.name} item={item} />
      ))}
      {shipped.length > 0 ? (
        <>
          <ListLabel
            onPress={() => setShippedOpen((value) => !value)}
            trailing={<Stamp meaning="done">{String(shipped.length)}</Stamp>}
          >
            {shippedOpen ? 'Shipped ▾' : 'Shipped ▸'}
          </ListLabel>
          {shippedOpen ? shipped.map((item) => <ItemRow key={item.name} item={item} />) : null}
        </>
      ) : null}
    </div>
  );
}
