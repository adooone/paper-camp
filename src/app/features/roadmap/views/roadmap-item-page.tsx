import { Markdown } from '@/app/components/markdown';
import type { ResolvedRoadmapItem } from '@/types/index';
import { Card, type FactItem, FactsGrid, PageTitle, Stamp, Text } from '@dendelion/paper-ui';
import { surface } from '@dendelion/paper-ui/tokens';
import { ITEM_STATE_STAMP } from '../constants';
import { type IdeaDateRange, formatFactDate } from '../helpers';

interface RoadmapItemPageProps {
  item: ResolvedRoadmapItem;
  horizonTitle: string | null;
  dateRange: IdeaDateRange | null;
}

const countLabel = (item: ResolvedRoadmapItem): string => {
  if (item.rollup.total === 0) return 'No ideas yet';
  if (item.state === 'in-progress' && item.readyToShip) return 'ready to ship';
  return `${item.rollup.done} of ${item.rollup.total} · ${item.rollup.open} open`;
};

export const RoadmapItemPage = ({ item, horizonTitle, dateRange }: RoadmapItemPageProps) => {
  const stateStamp = ITEM_STATE_STAMP[item.state];
  const facts: FactItem[] = [
    ...(horizonTitle ? [{ label: 'Horizon', value: horizonTitle }] : []),
    ...(dateRange?.since ? [{ label: 'Since', value: formatFactDate(dateRange.since) }] : []),
    ...(dateRange?.lastIdea
      ? [{ label: 'Last idea', value: formatFactDate(dateRange.lastIdea) }]
      : []),
  ];

  return (
    <div>
      <PageTitle className="mb-4">{item.name}</PageTitle>
      <Card size="small" texture={surface.card}>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {horizonTitle !== null && (
            <Stamp size="small" variant={stateStamp.variant}>
              {stateStamp.label}
            </Stamp>
          )}
          <Text face="handwritten" size="sm" tone="secondary">
            {countLabel(item)}
          </Text>
        </div>
        {item.description && (
          <div className="mb-4 opacity-[0.85]">
            <Markdown>{item.description}</Markdown>
          </div>
        )}
        {facts.length > 0 && <FactsGrid items={facts} layout="inline" />}
      </Card>
    </div>
  );
};
