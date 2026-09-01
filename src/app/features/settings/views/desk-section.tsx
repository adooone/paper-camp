import {
  Alert,
  Button,
  Card,
  Divider,
  Input,
  PlusIcon,
  Spinner,
  Switch,
} from '@dendelion/paper-ui';
import { useDeskSection } from '../hooks/use-desk-section';
import { DeskProposalModal } from '../modals';
import { DeskCheckRow } from './desk-check-row';
import { DeskServiceRow } from './desk-service-row';

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
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h2 className="m-0">Desk</h2>
          <p className="opacity-50 mt-1">
            Services, checks, and CI/release sources for this project's Stack panel.
          </p>
        </div>
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
      </div>
      {config === undefined && <p>Loading…</p>}
      {config === null && (
        <Alert variant="warning">
          No papercamp/config.json found — run <code>paper-camp init</code> in this directory first.
        </Alert>
      )}
      {config && (
        <>
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="m-0">Services</h3>
              <Button size="small" icon={<PlusIcon size={16} />} onClick={addService}>
                Add service
              </Button>
            </div>
            <Card size="small" texture="kraft">
              {services.length === 0 && <p className="opacity-[0.45] m-0 pb-2">No services yet.</p>}
              {services.map((service, idx) => (
                <DeskServiceRow
                  key={service.id}
                  service={service}
                  onSave={(next) => updateService(service.id, next)}
                  onRemove={() => removeService(service.id)}
                  isLast={idx === services.length - 1}
                />
              ))}
            </Card>
          </div>

          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="m-0">Checks</h3>
              <Button size="small" icon={<PlusIcon size={16} />} onClick={addCheck}>
                Add check
              </Button>
            </div>
            <Card size="small" texture="kraft">
              {checks.length === 0 && <p className="opacity-[0.45] m-0 pb-2">No checks yet.</p>}
              {checks.map((check, idx) => (
                <DeskCheckRow
                  key={check.id}
                  check={check}
                  onSave={(next) => updateCheck(check.id, next)}
                  onRemove={() => removeCheck(check.id)}
                  isLast={idx === checks.length - 1}
                />
              ))}
            </Card>
          </div>

          <div>
            <h3 className="m-0 mb-3">CI</h3>
            <Card size="small" texture="kraft">
              <div className="flex items-end gap-3 pb-3">
                <Input
                  size="small"
                  label="Repo (owner/name)"
                  value={ci.repo}
                  onChange={(e) => updateCi({ ...ci, repo: e.target.value })}
                />
                <Input
                  size="small"
                  label="Branch"
                  value={ci.branch ?? ''}
                  onChange={(e) => updateCi({ ...ci, branch: e.target.value || undefined })}
                />
              </div>
              <Divider />
              <div className="flex items-center justify-between pt-3">
                <span>Release Please</span>
                <Switch
                  checked={ci.releasePlease ?? false}
                  onChange={(e) => updateCi({ ...ci, releasePlease: e.target.checked })}
                />
              </div>
            </Card>
          </div>

          {proposal && diff && (
            <DeskProposalModal
              current={config.desk}
              proposal={proposal}
              diff={diff}
              onApply={applyProposal}
              onCancel={cancelProposal}
            />
          )}
        </>
      )}
    </div>
  );
};
