import { Markdown } from '@/app/components/markdown';
import type { ResolvedRoadmapItem } from '@/types/index';
import {
  Button,
  Card,
  type FactItem,
  FactsGrid,
  Menu,
  PageTitle,
  Stamp,
  Text,
} from '@dendelion/paper-ui';
import { surface } from '@dendelion/paper-ui/tokens';
import { ITEM_STATE_STAMP } from '../constants';
import { type IdeaDateRange, formatFactDate } from '../helpers';
import { AddCandidateForm } from './add-candidate-form';
import { CandidateRow } from './candidate-row';
import { IdeaRow } from './idea-row';
import { ShippedIdeasFold } from './shipped-ideas-fold';

interface RoadmapItemPageProps {
  item: ResolvedRoadmapItem;
  horizonTitle: string | null;
  dateRange: IdeaDateRange | null;
  otherHorizonTitles: string[];
  onOpenGraduated: (id: string | undefined, title: string) => void;
  onAddCandidate: (name: string) => Promise<void>;
  onPromoteCandidate: (candidateName: string) => void;
  onRemoveCandidate: (candidateName: string) => void;
  onEdit: () => void;
  onMove: (toHorizon: string) => void;
  onToggleShipped: () => void;
  onRemove: () => void;
  onPromote: () => void;
}

const countLabel = (item: ResolvedRoadmapItem): string => {
  if (item.rollup.total === 0) return 'No ideas yet';
  if (item.state === 'in-progress' && item.readyToShip) return 'ready to ship';
  return `${item.rollup.done} of ${item.rollup.total} · ${item.rollup.open} open`;
};

const SECTION_TITLE_CLASS =
  'truncate px-1 pt-2 font-handwritten text-md font-semibold leading-none opacity-70';

export const RoadmapItemPage = ({
  item,
  horizonTitle,
  dateRange,
  otherHorizonTitles,
  onOpenGraduated,
  onAddCandidate,
  onPromoteCandidate,
  onRemoveCandidate,
  onEdit,
  onMove,
  onToggleShipped,
  onRemove,
  onPromote,
}: RoadmapItemPageProps) => {
  const stateStamp = ITEM_STATE_STAMP[item.state];
  const facts: FactItem[] = [
    ...(horizonTitle ? [{ label: 'Horizon', value: horizonTitle }] : []),
    ...(dateRange?.since ? [{ label: 'Since', value: formatFactDate(dateRange.since) }] : []),
    ...(dateRange?.lastIdea
      ? [{ label: 'Last idea', value: formatFactDate(dateRange.lastIdea) }]
      : []),
  ];
  // Roadmap markdown only addresses items inside a `Horizon N` heading — a standing
  // concern (horizonTitle null) can't take thought mutations yet, so its thoughts render read-only.
  const isTrackedItem = horizonTitle !== null;
  const openIdeas = [...item.ideas]
    .filter((idea) => idea.status !== 'done' && idea.status !== 'dropped')
    .sort((a, b) => Number(b.status === 'in-progress') - Number(a.status === 'in-progress'));
  const shippedIdeas = item.ideas.filter(
    (idea) => idea.status === 'done' || idea.status === 'dropped',
  );

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
      <div className="flex flex-col gap-1">
        {openIdeas.length > 0 && (
          <>
            <div className={SECTION_TITLE_CLASS}>Open</div>
            <div className="flex flex-col">
              {openIdeas.map((idea) => (
                <IdeaRow
                  key={idea.id}
                  idea={idea}
                  onOpen={() => onOpenGraduated(idea.id, idea.title)}
                />
              ))}
            </div>
          </>
        )}
        {(isTrackedItem || item.candidates.length > 0) && (
          <>
            <div className={SECTION_TITLE_CLASS}>Thoughts</div>
            <div className="flex flex-col">
              {item.candidates.map((candidateName) =>
                isTrackedItem ? (
                  <CandidateRow
                    key={candidateName}
                    name={candidateName}
                    onPromote={() => onPromoteCandidate(candidateName)}
                    onRemove={() => onRemoveCandidate(candidateName)}
                  />
                ) : (
                  <div
                    key={candidateName}
                    className="border-black/10 border-b py-1.5 last:border-b-0"
                  >
                    {candidateName}
                  </div>
                ),
              )}
              {isTrackedItem && (
                <div className="pt-1">
                  <AddCandidateForm onAdd={onAddCandidate} />
                </div>
              )}
            </div>
          </>
        )}
        <ShippedIdeasFold ideas={shippedIdeas} onOpen={onOpenGraduated} />
      </div>
      {isTrackedItem && (
        <div className="mt-6 flex flex-wrap items-center gap-2 border-black/10 border-t pt-4">
          <Button type="button" variant="ghost" size="small" onClick={onEdit}>
            Edit
          </Button>
          {otherHorizonTitles.length > 0 ? (
            <Menu
              trigger={
                <Button type="button" variant="ghost" size="small">
                  Move
                </Button>
              }
              items={otherHorizonTitles.map((title) => ({
                id: title,
                label: title,
                onSelect: () => onMove(title),
              }))}
            />
          ) : (
            <Button type="button" variant="ghost" size="small" disabled>
              Move
            </Button>
          )}
          <Button type="button" variant="ghost" size="small" onClick={onToggleShipped}>
            {item.shippedOn !== undefined ? 'Reopen' : 'Mark shipped'}
          </Button>
          <Button type="button" variant="danger" size="small" onClick={onRemove}>
            Remove
          </Button>
          <div className="flex-1" />
          <Button type="button" variant="primary" size="small" onClick={onPromote}>
            Promote to idea
          </Button>
        </div>
      )}
    </div>
  );
};
