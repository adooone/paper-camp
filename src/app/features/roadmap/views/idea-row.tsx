import { PrBadge } from '@/app/features/plans/components/pr-badge';
import { STATUS_LABEL, STATUS_STAMP } from '@/app/features/plans/constants';
import type { ResolvedIdea } from '@/types/index';
import { Stamp } from '@dendelion/paper-ui';

interface IdeaRowProps {
  idea: ResolvedIdea;
  onOpen: () => void;
}

export const IdeaRow = ({ idea, onOpen }: IdeaRowProps) => (
  <div className="flex flex-col items-start gap-1.5 border-b border-black/10 py-1.5 last:border-b-0 sm:flex-row sm:items-center sm:gap-3">
    <button
      type="button"
      onClick={onOpen}
      className="flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap bg-transparent border-none p-0 cursor-pointer [font:inherit] text-inherit text-left"
    >
      {idea.title}
    </button>
    <div className="flex shrink-0 items-center gap-1.5">
      {idea.pr && <PrBadge pr={idea.pr} />}
      <Stamp
        size="small"
        fillColor={STATUS_STAMP[idea.status].fill}
        textColor={STATUS_STAMP[idea.status].text}
      >
        {STATUS_LABEL[idea.status]}
      </Stamp>
    </div>
  </div>
);
