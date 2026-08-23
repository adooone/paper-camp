import { useTrail } from '@/app/features/plans/hooks';
import { Skeleton } from '@dendelion/paper-ui';
import { ProvenanceTrailPanel } from '../components';

interface TrailSectionProps {
  planId: string | undefined;
  released?: string;
  reviewing?: boolean;
  reviewNote?: string;
}

export const TrailSection = ({ planId, released, reviewing, reviewNote }: TrailSectionProps) => {
  const trail = useTrail(planId);
  if (!planId) return null;
  return (
    <div className="text-xs opacity-80 shrink-0">
      {trail ? (
        <ProvenanceTrailPanel
          trail={trail}
          released={released}
          reviewing={reviewing}
          reviewNote={reviewNote}
        />
      ) : (
        // Reserves the real row's height (4 stamps + arrows) so the trail fetch
        // resolving doesn't push the header content below it down once it lands.
        <div className="max-w-xs" aria-hidden="true">
          <Skeleton variant="text" height={32} />
        </div>
      )}
    </div>
  );
};
