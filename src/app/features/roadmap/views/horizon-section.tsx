import type { PlanEntry, ResolvedRoadmapHorizon, ResolvedRoadmapItem } from '@/types/index';
import { RoadmapItemRow } from './roadmap-item-row';

const HORIZON_HEADER_CLASSES =
  'font-handwritten text-md font-semibold opacity-70 leading-none pt-2 px-1 pb-0';

interface HorizonSectionProps {
  horizon: ResolvedRoadmapHorizon;
  highlightedItem: string | undefined;
  graduatedByItem: (item: ResolvedRoadmapItem) => PlanEntry[];
  onPromote: (item: ResolvedRoadmapItem, candidateName?: string) => void;
  onAddCandidate: (itemName: string, name: string) => Promise<void>;
  onOpenGraduated: (id: string | undefined, title: string) => void;
}

export const HorizonSection = ({
  horizon,
  highlightedItem,
  graduatedByItem,
  onPromote,
  onAddCandidate,
  onOpenGraduated,
}: HorizonSectionProps) => (
  <div className="flex flex-col gap-1">
    <div className={HORIZON_HEADER_CLASSES}>{horizon.title}</div>
    <div className="flex flex-col">
      {horizon.items.map((item) => (
        <RoadmapItemRow
          key={item.name}
          item={item}
          graduated={graduatedByItem(item)}
          highlighted={item.name === highlightedItem}
          onPromote={() => onPromote(item)}
          onPromoteCandidate={(candidateName) => onPromote(item, candidateName)}
          onAddCandidate={(name) => onAddCandidate(item.name, name)}
          onOpenGraduated={onOpenGraduated}
        />
      ))}
    </div>
  </div>
);
