import { PrBadge } from '@/app/features/plans/components/pr-badge';
import { STATUS_LABEL, STATUS_STAMP } from '@/app/features/plans/constants';
import type { PlanEntry, PlanStatus, PrInfo, RoadmapLink } from '@/types/index';
import { Card, Stamp } from '@dendelion/paper-ui';

export interface MergedIdea {
  key: string;
  label: string;
  status: PlanStatus;
  pr?: PrInfo;
  planId?: string;
  planTitle?: string;
}

export const mergeIdeas = (links: RoadmapLink[], graduated: PlanEntry[]): MergedIdea[] => {
  const represented = new Set<string>();
  const merged: MergedIdea[] = graduated.map((plan) => {
    if (plan.id) represented.add(plan.id);
    if (plan.idea) represented.add(plan.idea);
    return {
      key: plan.title,
      label: plan.title,
      status: plan.status,
      pr: plan.pr,
      planId: plan.id,
      planTitle: plan.title,
    };
  });
  for (const link of links) {
    if (represented.has(link.id)) continue;
    merged.push({ key: link.id, label: link.id, status: link.status, pr: link.pr });
  }
  return merged;
};

interface IdeaRowProps {
  idea: MergedIdea;
  onOpen?: () => void;
}

export const IdeaRow = ({ idea, onOpen }: IdeaRowProps) => (
  <Card size="small" texture="kraft" className="plan-row-card">
    <div className="flex items-center gap-3">
      {onOpen ? (
        <button
          type="button"
          onClick={onOpen}
          className="flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap bg-transparent border-none p-0 cursor-pointer [font:inherit] text-inherit text-left"
        >
          {idea.label}
        </button>
      ) : (
        <span className="flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
          {idea.label}
        </span>
      )}
      {idea.pr && <PrBadge pr={idea.pr} />}
      <Stamp
        size="small"
        fillColor={STATUS_STAMP[idea.status].fill}
        textColor={STATUS_STAMP[idea.status].text}
      >
        {STATUS_LABEL[idea.status]}
      </Stamp>
    </div>
  </Card>
);
