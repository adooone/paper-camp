import { entityLink } from '@/app/hooks';
import type { PlanEntry } from '@/types/index';
import { Stamp } from '@dendelion/paper-ui';
import { useNavigate } from '@tanstack/react-router';

interface ParentLinkRowProps {
  plan: PlanEntry;
  otherPlans: PlanEntry[];
}

/** Only a fix entity carries `idea:` — its parent, linked, so the context that
 * produced it is one click away (IDEA-187). */
export const ParentLinkRow = ({ plan, otherPlans }: ParentLinkRowProps) => {
  const navigate = useNavigate();
  const isTicket = plan.entityKind === 'ticket';
  if ((!isTicket && plan.entityKind !== 'fix') || !plan.idea) return null;
  const parentId = plan.idea;
  const parent = otherPlans.find((p) => p.id === parentId);
  return (
    <div className="mb-3">
      {/* Raw <button>: a chromeless click target wrapping a stamp + label, not a paper-ui Button. */}
      <button
        type="button"
        onClick={() => navigate(entityLink(parent ?? { id: parentId, title: parentId }))}
        className="flex items-center gap-2 bg-none bg-transparent border-none p-0 cursor-pointer [font:inherit] text-inherit text-left"
      >
        <Stamp size="small" variant={isTicket ? 'info' : 'warning'}>
          {isTicket ? 'ticket' : 'fix'}
        </Stamp>
        <span className="text-sm opacity-70">
          {isTicket ? 'On board' : 'Fixes'} <span className="font-mono">{parentId}</span>
          {parent && ` — ${parent.title}`}
        </span>
      </button>
    </div>
  );
};
