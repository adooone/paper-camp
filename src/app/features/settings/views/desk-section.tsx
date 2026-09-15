import { RowSkeleton } from '@/app/components';
import { DeskProposalModal } from '@/app/components/stack-panel/desk-proposal-modal';
import { Alert, Button, Spinner } from '@dendelion/paper-ui';
import { SettingGroup } from '../components/setting-group';
import { SettingsHeader } from '../components/settings-header';
import { useDeskSection } from '../hooks/use-desk-section';
import { DeskCheckTable } from './desk-check-table';
import { DeskCiEditor } from './desk-ci-editor';
import { DeskServiceTable } from './desk-service-table';

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
          <SettingGroup label="Services">
            <DeskServiceTable
              services={services}
              onAdd={addService}
              onSave={updateService}
              onRemove={removeService}
            />
          </SettingGroup>

          <SettingGroup label="Checks">
            <DeskCheckTable
              checks={checks}
              onAdd={addCheck}
              onSave={updateCheck}
              onRemove={removeCheck}
            />
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
