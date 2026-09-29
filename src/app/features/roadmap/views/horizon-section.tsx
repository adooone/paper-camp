import type { ResolvedRoadmapHorizon, ResolvedRoadmapItem } from '@/types/index';
import { RoadmapItemRow } from './roadmap-item-row';
import { ShippedFold } from './shipped-fold';

const rollupLine = (horizon: ResolvedRoadmapHorizon) => {
  const notStarted = horizon.items.filter((item) => item.state === 'not-started').length;
  return `${horizon.rollup.done} of ${horizon.rollup.total} ideas shipped · ${notStarted} item${notStarted === 1 ? '' : 's'} not started`;
};

interface HorizonSectionProps {
  horizon: ResolvedRoadmapHorizon;
  onOpen: (item: ResolvedRoadmapItem) => void;
}

export const HorizonSection = ({ horizon, onOpen }: HorizonSectionProps) => {
  const openItems = horizon.items.filter((item) => item.state !== 'shipped');
  const shippedItems = horizon.items.filter((item) => item.state === 'shipped');

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-3 px-1 pt-2">
        <div className="min-w-0">
          <div className="truncate font-handwritten text-md font-semibold leading-none opacity-70">
            {horizon.title}
          </div>
          {horizon.intro && <div className="truncate text-sm opacity-60">{horizon.intro}</div>}
        </div>
        <div className="shrink-0 whitespace-nowrap font-handwritten text-2xs opacity-60">
          {rollupLine(horizon)}
        </div>
      </div>
      {horizon.items.length === 0 ? (
        <div className="px-1 py-2 text-sm opacity-50">Nothing here matches</div>
      ) : (
        <div className="flex flex-col">
          {openItems.map((item) => (
            <RoadmapItemRow key={item.name} item={item} onOpen={() => onOpen(item)} />
          ))}
          <ShippedFold items={shippedItems} onOpen={onOpen} />
        </div>
      )}
    </div>
  );
};
