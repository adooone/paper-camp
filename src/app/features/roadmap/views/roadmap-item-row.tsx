import type { ResolvedRoadmapItem } from '@/types/index';
import { Progress, Row, Stamp, Text } from '@dendelion/paper-ui';
import { color } from '@dendelion/paper-ui/tokens';
import { ITEM_STATE_STAMP } from '../constants';

interface RoadmapItemRowProps {
  item: ResolvedRoadmapItem;
  onOpen: () => void;
}

export const RoadmapItemRow = ({ item, onOpen }: RoadmapItemRowProps) => {
  const stateStamp = ITEM_STATE_STAMP[item.state];

  return (
    <Row
      surface="none"
      className="border-b border-black/10 px-0 py-0 last:border-b-0"
      columns={{ title: 'minmax(0,1fr)', meta: '6rem', trailing: '8rem' }}
      onClick={onOpen}
      ariaLabel={item.name}
      title={
        <div className="min-w-0">
          <div className="truncate">{item.name}</div>
          <div className="line-clamp-2 text-sm opacity-70 sm:line-clamp-1">{item.description}</div>
        </div>
      }
      meta={
        <div className="flex flex-col items-start gap-1">
          <Stamp size="small" variant={stateStamp.variant}>
            {stateStamp.label}
          </Stamp>
          {item.candidates.length > 0 && (
            <Stamp size="small" variant="muted">
              {item.candidates.length} thought{item.candidates.length === 1 ? '' : 's'}
            </Stamp>
          )}
        </div>
      }
      trailing={
        item.rollup.total > 0 ? (
          <div className="flex flex-col items-end gap-1">
            <Text face="handwritten" size="xs" tone="secondary" noWrap>
              {item.rollup.done} of {item.rollup.total} ·{' '}
              {item.state === 'in-progress' && item.readyToShip
                ? 'ready to ship'
                : `${item.rollup.open} open`}
            </Text>
            <Progress
              className="w-24"
              value={item.rollup.done}
              max={item.rollup.total}
              height={7}
              color={color.accentGreen}
              sketch
            />
          </div>
        ) : (
          <Text face="handwritten" size="xs" tone="secondary">
            No ideas yet
          </Text>
        )
      }
    />
  );
};
