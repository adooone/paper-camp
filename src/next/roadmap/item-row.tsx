import type { ResolvedRoadmapItem } from '@/types/index';
import { itemDetail, itemStateStamp } from '../shell/roadmap-model';
import { Hand } from '../ui/hand';
import { ListRow } from '../ui/list';
import { Stamp } from '../ui/stamp';

export function ItemRow({ item }: { item: ResolvedRoadmapItem }) {
  const stamp = itemStateStamp(item);
  return (
    <ListRow
      title={item.name}
      detail={
        <>
          {item.description ? (
            <Hand size="sm" color="inkSoft" numberOfLines={2}>
              {item.description}
            </Hand>
          ) : null}
          <Hand size="xs" color="inkFaint">
            {itemDetail(item)}
          </Hand>
        </>
      }
      trailing={<Stamp meaning={stamp.meaning}>{stamp.label}</Stamp>}
      muted={item.state === 'shipped'}
    />
  );
}
