import { Markdown } from '@/app/components/markdown';
import type { PlanEntry } from '@/types/index';

const sectionHeadingClass = 'font-display-luminari text-sm font-semibold opacity-[0.65]';

export const PlanBodySection = ({ plan }: { plan: PlanEntry }) => {
  if (!plan.body) return null;
  return (
    <div className="mb-4">
      <h3 className={`${sectionHeadingClass} mb-2`}>Description</h3>
      <div className="opacity-[0.85]">
        <Markdown>{plan.body}</Markdown>
      </div>
    </div>
  );
};
