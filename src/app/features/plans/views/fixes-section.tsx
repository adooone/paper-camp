import { entityRouteParam } from '@/app/hooks';
import type { PlanEntry } from '@/types/index';
import { Stamp } from '@dendelion/paper-ui';
import { useNavigate } from '@tanstack/react-router';
import { PlanIdStamp } from '../components';
import { STATUS_LABEL, STATUS_STAMP } from '../constants';

const sectionHeadingClass = 'font-display-luminari text-sm font-semibold opacity-[0.65]';

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
      <h3 className={`${sectionHeadingClass} mb-3`}>Fixes</h3>
      <div className="flex flex-col gap-2 mb-3">
        {fixes.map((fix) => (
          <button
            key={fix.title}
            type="button"
            onClick={() =>
              navigate({
                to: '/plans/$planId',
                params: { planId: entityRouteParam(fix.id, fix.title) },
              })
            }
            className="flex items-center gap-2 bg-none bg-transparent border-none p-0 cursor-pointer [font:inherit] text-inherit text-left text-sm"
          >
            <PlanIdStamp id={fix.id} />
            <span className="flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
              {fix.title}
            </span>
            <Stamp
              size="small"
              fillColor={STATUS_STAMP[fix.status].fill}
              textColor={STATUS_STAMP[fix.status].text}
            >
              {STATUS_LABEL[fix.status]}
            </Stamp>
          </button>
        ))}
      </div>
    </div>
  );
};
