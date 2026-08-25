import { Markdown } from '@/app/components/markdown';
import { useState } from 'react';

interface GoalBannerProps {
  goal: string;
}

export const GoalBanner = ({ goal }: GoalBannerProps) => {
  const [expanded, setExpanded] = useState(false);
  const [firstParagraph, ...restParagraphs] = goal.split(/\n{2,}/);
  const hasMore = restParagraphs.length > 0;

  return (
    <div className="mb-6 pb-4 border-b border-black/[8%]">
      <span className="font-handwritten text-xs font-semibold opacity-[0.55]">The goal</span>
      <div className="text-sm leading-relaxed opacity-80 mt-2">
        <Markdown>{firstParagraph}</Markdown>
        {expanded && hasMore && <Markdown>{restParagraphs.join('\n\n')}</Markdown>}
      </div>
      {hasMore && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="bg-transparent border-none p-0 mt-2 cursor-pointer text-2xs opacity-[0.65] underline"
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  );
};
