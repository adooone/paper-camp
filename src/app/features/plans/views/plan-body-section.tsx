import { Markdown } from '@/app/components/markdown';
import type { PlanEntry } from '@/types/index';
import { SectionHeading } from '@dendelion/folk-ui';

interface PlanBodySectionProps {
  plan: PlanEntry;
  onOpenAssetPreview?: (url: string) => void;
}

export const PlanBodySection = ({ plan, onOpenAssetPreview }: PlanBodySectionProps) => {
  if (!plan.body) return null;
  return (
    <div className="mb-4">
      <SectionHeading as="h3" className="mb-2">
        Description
      </SectionHeading>
      <div className="opacity-[0.85]">
        <Markdown ideaId={plan.id ?? undefined} onOpenAssetPreview={onOpenAssetPreview}>
          {plan.body}
        </Markdown>
      </div>
    </div>
  );
};
