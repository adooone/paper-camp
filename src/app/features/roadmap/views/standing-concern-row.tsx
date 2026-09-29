import type { ResolvedRoadmapItem } from '@/types/index';
import { Row, Text } from '@dendelion/paper-ui';

interface StandingConcernRowProps {
  item: ResolvedRoadmapItem;
  onOpen: () => void;
}

export const StandingConcernRow = ({ item, onOpen }: StandingConcernRowProps) => (
  <Row
    surface="none"
    className="border-b border-black/10 px-0 last:border-b-0"
    columns={{ title: 'minmax(0,1fr)', meta: '6rem', trailing: '8rem' }}
    onClick={onOpen}
    ariaLabel={item.name}
    title={
      <div className="min-w-0">
        <div className="truncate">{item.name}</div>
        <div className="line-clamp-2 text-sm opacity-70 sm:line-clamp-1">{item.description}</div>
      </div>
    }
    trailing={
      <Text face="handwritten" size="xs" tone="secondary" noWrap>
        {item.rollup.done} shipped · {item.rollup.open} open
      </Text>
    }
  />
);
