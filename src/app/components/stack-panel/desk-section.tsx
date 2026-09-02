// Specific file, not the `actions` barrel: the barrel pulls in the whole plans
// graph and loops back to components/index.ts, which depcruise fails as a cycle.
import { RefreshButton } from '@/app/features/plans/actions/refresh-button';
import { useDeskDiscovery } from '@/app/hooks/use-desk-discovery';
import { Button, Divider, Skeleton, Spinner } from '@dendelion/paper-ui';
import { CHECKS_GROUP_LABEL, ChecksGroup } from './checks-group';
import { CI_GROUP_LABEL, CiGroup } from './ci-group';
import { DeskProposalModal } from './desk-proposal-modal';
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

const DeskSectionEmpty = ({
  discovering,
  onDiscover,
}: {
  discovering: boolean;
  onDiscover: () => void;
}) => (
  <div className="flex flex-1 flex-col items-center justify-center gap-3">
    <p className="m-0 text-center text-xs text-desk-text-muted">
      Desk isn't configured — scan the project for one-click checks and long-running services.
    </p>
    <Button size="small" surface="chalkboard" onClick={onDiscover} disabled={discovering}>
      {discovering ? (
        <>
          <Spinner size="small" surface="chalkboard" label="Discovering" /> Discovering…
        </>
      ) : (
        'Discover from project'
      )}
    </Button>
  </div>
);

export const DeskSection = () => {
  const {
    configLoaded,
    current,
    proposal,
    diff,
    discovering,
    startDiscovery,
    cancelProposal,
    applyProposal,
  } = useDeskDiscovery();

  return (
    <>
      <Divider surface="chalkboard" />
      <div className="flex flex-1 flex-col p-[var(--pc-stack-pad)]">
        <div className="flex items-center justify-between gap-2 mb-3">
          <h3 className={`${sectionLabelClassName} m-0`}>Desk</h3>
          <RefreshButton
            label="Fetch from GitHub"
            refreshingLabel="Fetching…"
            surface="chalkboard"
          />
        </div>
        {!configLoaded ? (
          <DeskSectionSkeleton />
        ) : current ? (
          <div className="flex flex-col gap-4">
            <ServicesGroup />
            <ChecksGroup />
            <CiGroup />
          </div>
        ) : (
          <DeskSectionEmpty discovering={discovering} onDiscover={startDiscovery} />
        )}
      </div>
      {proposal && diff && (
        <DeskProposalModal
          current={current}
          proposal={proposal}
          diff={diff}
          onApply={applyProposal}
          onCancel={cancelProposal}
        />
      )}
    </>
  );
};
