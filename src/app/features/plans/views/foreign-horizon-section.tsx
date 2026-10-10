import { HorizonSection } from '@/app/features/roadmap';
import { ProjectChip, type ScopeRow } from '@/app/features/scope';
import type { ResolvedRoadmapItem } from '@/types/index';
import { Divider } from '@dendelion/paper-ui';
import type { ScopeRoadmap } from '../hooks';

interface ForeignHorizonSectionProps {
  entry: ScopeRoadmap;
  onOpenCrossProject: (project: ScopeRow, path: string) => void;
}

/** Another scope project's roadmap, read-only — its own section under Horizon,
 * its horizons nested inside (IDEA-291). Writes stay on each project's own page. */
export const ForeignHorizonSection = ({
  entry,
  onOpenCrossProject,
}: ForeignHorizonSectionProps) => {
  const { project, roadmap } = entry;
  if (!roadmap) return null;

  const handleOpenItem = (item: ResolvedRoadmapItem) =>
    onOpenCrossProject(project, `/roadmap/${encodeURIComponent(item.name)}`);

  return (
    <div className="mt-8">
      <Divider sketch className="my-6" />
      <div className="mb-3">
        <ProjectChip project={project} />
      </div>
      {roadmap.horizons.length === 0 ? (
        <p className="opacity-50 text-sm">
          No <code>ROADMAP.md</code> found at that project's root.
        </p>
      ) : (
        <div className="flex flex-col">
          {roadmap.horizons.map((horizon, index) => (
            <div key={horizon.title}>
              {index > 0 && <Divider sketch className="my-6" />}
              <HorizonSection horizon={horizon} onOpen={handleOpenItem} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
