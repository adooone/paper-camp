import { EmptyState, RowSkeleton } from '@/app/components';
import { DeskProposalModal } from '@/app/components/stack-panel/desk-proposal-modal';
import { Alert, Button, PlusIcon, Spinner } from '@dendelion/paper-ui';
import { SettingGroup } from '../components/setting-group';
import { SettingsHeader } from '../components/settings-header';
import { useDeskSection } from '../hooks/use-desk-section';
import { DeskCheckRow } from './desk-check-row';
import { DeskCheckRowHeader } from './desk-check-row-header';
import { DeskCiEditor } from './desk-ci-editor';
import { DeskServiceRow } from './desk-service-row';
import { DeskServiceRowHeader } from './desk-service-row-header';

export const DeskSection = () => {
  const {
    config,
    services,
    checks,
    ci,
    proposal,
    diff,
    discovering,
    addService,
    updateService,
    removeService,
    addCheck,
    updateCheck,
    removeCheck,
    updateCi,
    startDiscovery,
    cancelProposal,
    applyProposal,
  } = useDeskSection();

  return (
    <div>
      <SettingsHeader title="Desk">
        {config && (
          <Button size="small" onClick={startDiscovery} disabled={discovering}>
            {discovering ? (
              <>
                <Spinner size="small" label="Discovering" /> Discovering…
              </>
            ) : config.desk ? (
              'Re-scan with discovery'
            ) : (
              'Discover from project'
            )}
          </Button>
        )}
      </SettingsHeader>

      {config === undefined && <RowSkeleton boxless />}
      {config === null && (
        <Alert variant="warning">
          No papercamp/config.json found — run <code>paper-camp init</code> in this directory first.
        </Alert>
      )}
      {config && (
        <div className="flex flex-col gap-4">
          <SettingGroup
            label="Services"
            action={
              <Button size="small" icon={<PlusIcon size={16} />} onClick={addService}>
                Add
              </Button>
            }
          >
            {services.length === 0 ? (
              <EmptyState message="No services yet." />
            ) : (
              <>
                <DeskServiceRowHeader />
                {services.map((service) => (
                  <DeskServiceRow
                    key={service.id}
                    service={service}
                    onSave={(next) => updateService(service.id, next)}
                    onRemove={() => removeService(service.id)}
                  />
                ))}
              </>
            )}
          </SettingGroup>

          <SettingGroup
            label="Checks"
            action={
              <Button size="small" icon={<PlusIcon size={16} />} onClick={addCheck}>
                Add
              </Button>
            }
          >
            {checks.length === 0 ? (
              <EmptyState message="No checks yet." />
            ) : (
              <>
                <DeskCheckRowHeader />
                {checks.map((check) => (
                  <DeskCheckRow
                    key={check.id}
                    check={check}
                    onSave={(next) => updateCheck(check.id, next)}
                    onRemove={() => removeCheck(check.id)}
                  />
                ))}
              </>
            )}
          </SettingGroup>

          <SettingGroup label="CI">
            <DeskCiEditor ci={ci} onSave={updateCi} />
          </SettingGroup>

          {proposal && diff && (
            <DeskProposalModal
              current={config.desk}
              proposal={proposal}
              diff={diff}
              onApply={applyProposal}
              onCancel={cancelProposal}
            />
          )}
        </div>
      )}
    </div>
  );
};
