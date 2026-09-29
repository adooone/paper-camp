import type { ResolvedRoadmapItem } from '@/types/index';
import { StandingConcernRow } from './standing-concern-row';

interface StandingConcernsSectionProps {
  items: ResolvedRoadmapItem[];
  onOpen: (item: ResolvedRoadmapItem) => void;
}

export const StandingConcernsSection = ({ items, onOpen }: StandingConcernsSectionProps) => {
  if (items.length === 0) return null;

  return (
    <div className="flex flex-col gap-1">
      <div className="truncate px-1 pt-2 font-handwritten text-md font-semibold leading-none opacity-70">
        Standing concerns
      </div>
      <div className="flex flex-col">
        {items.map((item) => (
          <StandingConcernRow key={item.name} item={item} onOpen={() => onOpen(item)} />
        ))}
      </div>
    </div>
  );
};
