import { PrBadge } from '@/app/features/plans/components/pr-badge';
import { STATUS_LABEL, STATUS_STAMP } from '@/app/features/plans/constants';
import { surface } from '@/app/styles/tokens';
import type { ResolvedIdea } from '@/types/index';
import { Card, Stamp } from '@dendelion/paper-ui';

interface IdeaRowProps {
  idea: ResolvedIdea;
  onOpen: () => void;
}

export const IdeaRow = ({ idea, onOpen }: IdeaRowProps) => (
  <Card size="small" texture={surface.card} className="plan-row-card">
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={onOpen}
        className="flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap bg-transparent border-none p-0 cursor-pointer [font:inherit] text-inherit text-left"
      >
        {idea.title}
      </button>
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
