import { STATUS_STAMP } from '@/app/features/plans/constants';
import type { PlanEntry, ResolvedRoadmapItem } from '@/types/index';
import { Button, Stamp } from '@dendelion/paper-ui';
import { useEffect, useState } from 'react';
import { AddCandidateForm } from './add-candidate-form';
import { CandidateRow } from './candidate-row';
import { IdeaRow, mergeIdeas } from './idea-row';
import { ProgressBar } from './progress-bar';

const graduationCounts = (graduated: PlanEntry[]) => ({
  shipped: graduated.filter((p) => p.status === 'done').length,
  queued: graduated.filter((p) => p.status !== 'done' && p.status !== 'dropped').length,
});

const ChevronRightIcon = ({ size = 14 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

interface RoadmapItemRowProps {
  item: ResolvedRoadmapItem;
  graduated: PlanEntry[];
  highlighted: boolean;
  onPromote: () => void;
  onPromoteCandidate: (candidateName: string) => void;
  onAddCandidate: (name: string) => Promise<void>;
  onOpenGraduated: (id: string | undefined, title: string) => void;
}

export const RoadmapItemRow = ({
  item,
  graduated,
  highlighted,
  onPromote,
  onPromoteCandidate,
  onAddCandidate,
  onOpenGraduated,
}: RoadmapItemRowProps) => {
  const [expanded, setExpanded] = useState(highlighted);
  const { shipped, queued } = graduationCounts(graduated);
  const candidates = item.candidates.length;
  const ideas = mergeIdeas(item.links, graduated);

  useEffect(() => {
    if (highlighted) setExpanded(true);
  }, [highlighted]);

  return (
    <div
      className={`border-b border-black/10 last:border-b-0 ${highlighted ? 'roadmap-item-highlighted outline outline-2 outline-offset-[-2px] outline-[rgba(200,154,90,0.5)]' : ''}`}
    >
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-3 py-2.5 px-0 bg-transparent border-none cursor-pointer text-left [font:inherit] text-inherit"
      >
        <span
          className={`inline-flex items-center opacity-50 shrink-0 ${expanded ? 'rotate-90' : ''}`}
        >
          <ChevronRightIcon />
        </span>
        <span className="font-semibold flex-1 min-w-0 truncate">{item.name}</span>
        <ProgressBar done={item.rollup.done} total={item.rollup.total} />
        {queued > 0 && (
          <Stamp
            size="small"
            fillColor={STATUS_STAMP.planned.fill}
            textColor={STATUS_STAMP.planned.text}
          >
            {queued} in queue
          </Stamp>
        )}
        {shipped > 0 && (
          <Stamp size="small" fillColor={STATUS_STAMP.done.fill} textColor={STATUS_STAMP.done.text}>
            {shipped} shipped
          </Stamp>
        )}
        {candidates > 0 && (
          <Stamp size="small" fillColor="rgba(0, 0, 0, 0.06)" textColor="rgba(0, 0, 0, 0.55)">
            {candidates} candidate{candidates === 1 ? '' : 's'}
          </Stamp>
        )}
      </button>
      {expanded && (
        <div className="flex flex-col gap-1 pl-6 pb-4">
          <span className="text-sm opacity-70">{item.description}</span>
          {ideas.map((idea) => (
            <IdeaRow
              key={idea.key}
              idea={idea}
              onOpen={
                idea.planTitle
                  ? () => onOpenGraduated(idea.planId, idea.planTitle as string)
                  : undefined
              }
            />
          ))}
          {item.candidates.map((candidateName) => (
            <CandidateRow
              key={candidateName}
              name={candidateName}
              onPromote={() => onPromoteCandidate(candidateName)}
            />
          ))}
          <AddCandidateForm onAdd={onAddCandidate} />
          <Button
            type="button"
            variant="ghost"
            size="small"
            onClick={onPromote}
            className="self-start"
          >
            Promote to idea
          </Button>
        </div>
      )}
    </div>
  );
};
