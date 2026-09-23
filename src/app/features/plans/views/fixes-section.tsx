import { entityLink } from '@/app/hooks';
import type { PlanEntry } from '@/types/index';
import { SectionHeading, Stamp } from '@dendelion/paper-ui';
import { useNavigate } from '@tanstack/react-router';
import { PlanIdStamp } from '../components';
import { STATUS_LABEL, STATUS_STAMP } from '../constants';

interface FixesSectionProps {
  plan: PlanEntry;
  otherPlans: PlanEntry[];
}

/** Every linked fix entity with its status — the parent stays archived and
 * read-only, but it knows what came after it (IDEA-187). */
export const FixesSection = ({ plan, otherPlans }: FixesSectionProps) => {
  const navigate = useNavigate();
  const fixes = otherPlans.filter((p) => p.entityKind === 'fix' && p.idea === plan.id);
  if (fixes.length === 0) return null;
  return (
    <div className="mb-5">
      <SectionHeading as="h3" className="mb-3">
        Fixes
      </SectionHeading>
      <div className="flex flex-col gap-2 mb-3">
        {fixes.map((fix) => (
          <button
            key={fix.title}
            type="button"
            onClick={() => navigate(entityLink(fix))}
            className="flex items-center gap-2 bg-none bg-transparent border-none p-0 cursor-pointer [font:inherit] text-inherit text-left text-sm"
          >
            <PlanIdStamp id={fix.id} />
            <span className="flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
              {fix.title}
            </span>
            <Stamp size="small" variant={STATUS_STAMP[fix.status]}>
              {STATUS_LABEL[fix.status]}
            </Stamp>
          </button>
        ))}
      </div>
    </div>
  );
};
