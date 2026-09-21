import type { ResolvedRoadmapItem } from '@/types/index';
import { Accordion, Button, Menu, Stamp } from '@dendelion/paper-ui';
import { useEffect, useState } from 'react';
import { HIGHLIGHT_OUTLINE_CLASS, ITEM_STATE_STAMP } from '../constants';
import { AddCandidateForm } from './add-candidate-form';
import { CandidateRow } from './candidate-row';
import { IdeaRow } from './idea-row';
import { RoughProgressBar } from './rough-progress-bar';
import { ShippedIdeasFold } from './shipped-ideas-fold';

// Phone: name and description take the full width, state and progress share the row under them.
const GRID_CLASS =
  'grid flex-1 min-w-0 items-center gap-x-3 gap-y-1 grid-cols-[6rem_minmax(0,1fr)] sm:grid-cols-[minmax(0,1fr)_6rem_8rem]';

interface RoadmapItemRowProps {
  item: ResolvedRoadmapItem;
  highlighted: boolean;
  otherHorizonTitles: string[];
  onPromote: () => void;
  onPromoteCandidate: (candidateName: string) => void;
  onAddCandidate: (name: string) => Promise<void>;
  onOpenGraduated: (id: string | undefined, title: string) => void;
  onEdit: () => void;
  onMove: (toHorizon: string) => void;
  onToggleShipped: () => void;
  onRemove: () => void;
  onRemoveCandidate: (candidateName: string) => void;
}

export const RoadmapItemRow = ({
  item,
  highlighted,
  otherHorizonTitles,
  onPromote,
  onPromoteCandidate,
  onAddCandidate,
  onOpenGraduated,
  onEdit,
  onMove,
  onToggleShipped,
  onRemove,
  onRemoveCandidate,
}: RoadmapItemRowProps) => {
  const [expanded, setExpanded] = useState(highlighted);
  const stateStamp = ITEM_STATE_STAMP[item.state];
  const openIdeas = item.ideas.filter(
    (idea) => idea.status !== 'done' && idea.status !== 'dropped',
  );
  const shippedIdeas = item.ideas.filter(
    (idea) => idea.status === 'done' || idea.status === 'dropped',
  );

  useEffect(() => {
    if (highlighted) setExpanded(true);
  }, [highlighted]);

  return (
    <div
      className={`border-b border-black/10 last:border-b-0 ${highlighted ? `roadmap-item-highlighted outline outline-2 outline-offset-[-2px] ${HIGHLIGHT_OUTLINE_CLASS}` : ''}`}
    >
      <Accordion
        expanded={expanded}
        onToggle={() => setExpanded((v) => !v)}
        title={
          <div className={GRID_CLASS}>
            <div className="col-span-2 min-w-0 sm:col-span-1">
              <div className="truncate">{item.name}</div>
              <div className="line-clamp-2 text-sm opacity-70 sm:line-clamp-1">
                {item.description}
              </div>
            </div>
            <div>
              <Stamp size="small" variant={stateStamp.variant}>
                {stateStamp.label}
              </Stamp>
            </div>
            <div className="min-w-0">
              {item.rollup.total > 0 ? (
                <>
                  <div className="font-handwritten text-2xs opacity-70 whitespace-nowrap">
                    {item.rollup.done} of {item.rollup.total} ·{' '}
                    {item.state === 'in-progress' && item.readyToShip
                      ? 'ready to ship'
                      : `${item.rollup.open} open`}
                  </div>
                  <RoughProgressBar done={item.rollup.done} total={item.rollup.total} />
                </>
              ) : (
                <div className="font-handwritten text-2xs opacity-50">No ideas yet</div>
              )}
            </div>
          </div>
        }
      >
        <div className="flex flex-col gap-1 pb-2">
          <div className="flex flex-wrap items-center gap-2 border-black/10 border-b pb-2">
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
          </div>
          {openIdeas.map((idea) => (
            <IdeaRow
              key={idea.id}
              idea={idea}
              onOpen={() => onOpenGraduated(idea.id, idea.title)}
            />
          ))}
          {item.candidates.map((candidateName) => (
            <CandidateRow
              key={candidateName}
              name={candidateName}
              onPromote={() => onPromoteCandidate(candidateName)}
              onRemove={() => onRemoveCandidate(candidateName)}
            />
          ))}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <div className="min-w-48 flex-1">
              <AddCandidateForm onAdd={onAddCandidate} />
            </div>
            <Button type="button" variant="ghost" size="small" onClick={onPromote}>
              Promote to idea
            </Button>
          </div>
          <ShippedIdeasFold ideas={shippedIdeas} onOpen={onOpenGraduated} />
        </div>
      </Accordion>
    </div>
  );
};
