import { entityLink } from '@/app/hooks';
import { isBlockingNeed } from '@/core/needs-status';
import type { PlanEntry } from '@/types/index';
import { Stamp } from '@dendelion/paper-ui';
import { useNavigate } from '@tanstack/react-router';

interface NeedsRowProps {
  plan: PlanEntry;
}

/** One line per unresolved `needs:` ref (IDEA-291): a found-but-open need waits,
 * linked to the idea it's waiting on; a dead ref can't find what it names and
 * never blocks. A satisfied need renders nothing — there's nothing left to say. */
export const NeedsRow = ({ plan }: NeedsRowProps) => {
  const navigate = useNavigate();
  const pending = (plan.resolvedNeeds ?? []).filter((need) => isBlockingNeed(need) || !need.found);
  if (pending.length === 0) return null;

  return (
    <div className="mb-3 flex flex-col gap-1">
      {pending.map((need) => {
        if (!isBlockingNeed(need)) {
          return (
            <div key={need.raw} className="flex items-center gap-2">
              <Stamp size="small" variant="error">
                can't find
              </Stamp>
              <span className="text-sm opacity-70 font-mono">{need.raw}</span>
            </div>
          );
        }
        const label = (
          <span className="text-sm opacity-70">
            Waits for {need.projectName && <span className="font-mono">{need.projectName} </span>}
            <span className="font-mono">{need.id}</span>
            {need.title && ` — ${need.title}`}
          </span>
        );
        // A cross-project need can't link anywhere yet — this project's mount has no
        // route for another project's ids until the multi-project scope lands.
        if (need.projectSlug) {
          return (
            <div key={need.raw} className="flex items-center gap-2">
              <Stamp size="small" variant="warning">
                waits
              </Stamp>
              {label}
            </div>
          );
        }
        return (
          <button
            key={need.raw}
            type="button"
            onClick={() => navigate(entityLink({ id: need.id, title: need.title ?? need.id }))}
            className="flex items-center gap-2 bg-none bg-transparent border-none p-0 cursor-pointer [font:inherit] text-inherit text-left"
          >
            <Stamp size="small" variant="warning">
              waits
            </Stamp>
            {label}
          </button>
        );
      })}
    </div>
  );
};
