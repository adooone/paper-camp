import { Markdown } from '@/app/components/markdown';
import type { PlanEntry } from '@/types/index';
import { SectionHeading } from '@dendelion/paper-ui';

interface PlanBodySectionProps {
  plan: PlanEntry;
}

export const PlanBodySection = ({ plan }: PlanBodySectionProps) => {
  if (!plan.body) return null;
  return (
    <div className="mb-4">
      <SectionHeading as="h3" className="mb-2">
        Description
      </SectionHeading>
      <div className="opacity-[0.85]">
        <Markdown>{plan.body}</Markdown>
      </div>
    </div>
  );
};
