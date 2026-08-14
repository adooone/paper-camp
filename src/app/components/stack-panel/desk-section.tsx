import { useDeskManifest } from '@/app/hooks/use-desk-manifest';
import { Divider, Skeleton } from '@dendelion/paper-ui';
import { BuildGroup } from './build-group';
import { ChecksGroup } from './checks-group';
import { CiGroup } from './ci-group';
import { ServicesGroup } from './services-group';
import { groupLabelClassName, sectionLabelClassName } from './shared';

const GROUP_LABELS = ['Services', 'Checks', 'Build', 'CI & release'];

const DeskSectionSkeleton = () => (
  <div className="flex flex-col gap-4" aria-hidden="true">
    {GROUP_LABELS.map((label) => (
      <div key={label}>
        <div className={groupLabelClassName}>{label}</div>
        <Skeleton variant="rect" width="100%" height={28} surface="chalkboard" />
      </div>
    ))}
  </div>
);

export const DeskSection = () => {
  const { desk, loading } = useDeskManifest();

  if (!loading && !desk) return null;

  return (
    <>
      <Divider surface="chalkboard" />
      <div className="min-h-0 flex-1 overflow-y-auto p-6">
        <div className={sectionLabelClassName}>Desk</div>
        {loading ? (
          <DeskSectionSkeleton />
        ) : (
          <div className="flex flex-col gap-4">
            <ServicesGroup />
            <ChecksGroup />
            <BuildGroup />
            <CiGroup />
          </div>
        )}
      </div>
    </>
  );
};
