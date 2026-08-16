// Specific file, not the `actions` barrel: the barrel pulls in the whole plans
// graph and loops back to components/index.ts, which depcruise fails as a cycle.
import { RefreshButton } from '@/app/features/plans/actions/refresh-button';
import { useDeskManifest } from '@/app/hooks/use-desk-manifest';
import { Divider, Skeleton } from '@dendelion/paper-ui';
import { CHECKS_GROUP_LABEL, ChecksGroup } from './checks-group';
import { CI_GROUP_LABEL, CiGroup } from './ci-group';
import { SERVICES_GROUP_LABEL, ServicesGroup } from './services-group';
import { groupLabelClassName, sectionLabelClassName } from './shared';

const GROUP_LABELS = [SERVICES_GROUP_LABEL, CHECKS_GROUP_LABEL, CI_GROUP_LABEL];

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

const DeskSectionEmpty = () => (
  <div className="flex flex-1 items-center justify-center">
    <p className="m-0 text-center text-xs text-desk-text-muted">
      Desk isn't configured — add <code>desk</code> to <code>papercamp/config.json</code>.
    </p>
  </div>
);

export const DeskSection = () => {
  const { desk, loading } = useDeskManifest();

  return (
    <>
      <Divider surface="chalkboard" />
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-6">
        <div className="flex items-center justify-between gap-2 mb-3">
          <h3 className={`${sectionLabelClassName} m-0`}>Desk</h3>
          <RefreshButton
            label="Fetch from GitHub"
            refreshingLabel="Fetching…"
            surface="chalkboard"
          />
        </div>
        {loading ? (
          <DeskSectionSkeleton />
        ) : desk ? (
          <div className="flex flex-col gap-4">
            <ServicesGroup />
            <ChecksGroup />
            <CiGroup />
          </div>
        ) : (
          <DeskSectionEmpty />
        )}
      </div>
    </>
  );
};
