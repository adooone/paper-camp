import type { DeskCheck, DeskCi, DeskConfig, DeskService } from '@/types/index';
import { Button, CloseIcon, Divider, IconButton, Input, Modal, Stamp } from '@dendelion/paper-ui';
import { useState } from 'react';
import type { DeskDiff } from '../helpers';

interface DeskProposalModalProps {
  current: DeskConfig | null | undefined;
  proposal: DeskConfig;
  diff: DeskDiff;
  onApply: (next: DeskConfig) => Promise<void>;
  onCancel: () => void;
}

interface EditableService extends DeskService {
  rowKey: string;
  status: 'added' | 'changed' | 'kept' | 'removed';
}

interface EditableCheck extends DeskCheck {
  rowKey: string;
  status: 'added' | 'changed' | 'kept' | 'removed';
}

const stampFor = (status: EditableService['status']) => {
  if (status === 'added') return { variant: 'success' as const, label: 'new' };
  if (status === 'changed') return { variant: 'info' as const, label: 'changed' };
  if (status === 'removed') return { variant: 'error' as const, label: 'will remove' };
  return { variant: 'neutral' as const, label: 'kept' };
};

function buildServiceRows(
  current: DeskConfig | null | undefined,
  proposal: DeskConfig,
): {
  rows: EditableService[];
} {
  const currentServices = current?.services ?? [];
  const proposedServices = proposal.services ?? [];
  const proposedKeys = new Set(proposedServices.map((s) => s.cmd));
  const rows: EditableService[] = [];
  for (const s of proposedServices) {
    const before = currentServices.find((c) => c.cmd === s.cmd);
    const status: EditableService['status'] = before
      ? JSON.stringify(before) === JSON.stringify(s)
        ? 'kept'
        : 'changed'
      : 'added';
    rows.push({ ...s, rowKey: crypto.randomUUID(), status });
  }
  for (const c of currentServices) {
    if (!proposedKeys.has(c.cmd)) {
      rows.push({
        ...c,
        rowKey: crypto.randomUUID(),
        status: 'removed',
        port: undefined,
        healthcheck: undefined,
      });
    }
  }
  return { rows };
}

function buildCheckRows(
  current: DeskConfig | null | undefined,
  proposal: DeskConfig,
): {
  rows: EditableCheck[];
} {
  const currentChecks = current?.checks ?? [];
  const proposedChecks = proposal.checks ?? [];
  const proposedKeys = new Set(proposedChecks.map((c) => c.cmd));
  const rows: EditableCheck[] = [];
  for (const c of proposedChecks) {
    const before = currentChecks.find((x) => x.cmd === c.cmd);
    const status: EditableCheck['status'] = before
      ? JSON.stringify(before) === JSON.stringify(c)
        ? 'kept'
        : 'changed'
      : 'added';
    rows.push({ ...c, rowKey: crypto.randomUUID(), status });
  }
  for (const x of currentChecks) {
    if (!proposedKeys.has(x.cmd)) {
      rows.push({ ...x, rowKey: crypto.randomUUID(), status: 'removed' });
    }
  }
  return { rows };
}

export const DeskProposalModal = ({
  current,
  proposal,
  diff,
  onApply,
  onCancel,
}: DeskProposalModalProps) => {
  const [services, setServices] = useState<EditableService[]>(
    () => buildServiceRows(current, proposal).rows,
  );
  const [checks, setChecks] = useState<EditableCheck[]>(
    () => buildCheckRows(current, proposal).rows,
  );
  const [ci, setCi] = useState<DeskCi | undefined>(proposal.ci);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const updateService = (rowKey: string, patch: Partial<DeskService>) =>
    setServices((prev) => prev.map((s) => (s.rowKey === rowKey ? { ...s, ...patch } : s)));

  const removeService = (rowKey: string) =>
    setServices((prev) => prev.filter((s) => s.rowKey !== rowKey));

  const addService = () =>
    setServices((prev) => [
      ...prev,
      { rowKey: crypto.randomUUID(), name: '', cmd: '', status: 'added' },
    ]);

  const updateCheck = (rowKey: string, patch: Partial<DeskCheck>) =>
    setChecks((prev) => prev.map((c) => (c.rowKey === rowKey ? { ...c, ...patch } : c)));

  const removeCheck = (rowKey: string) =>
    setChecks((prev) => prev.filter((c) => c.rowKey !== rowKey));

  const addCheck = () =>
    setChecks((prev) => [
      ...prev,
      { rowKey: crypto.randomUUID(), name: '', cmd: '', status: 'added' },
    ]);

  const completeServices = services
    .filter((s) => s.status !== 'removed' && s.name.trim() !== '' && s.cmd.trim() !== '')
    .map(({ rowKey: _rowKey, status: _status, ...rest }) => rest);
  const completeChecks = checks
    .filter((c) => c.status !== 'removed' && c.name.trim() !== '' && c.cmd.trim() !== '')
    .map(({ rowKey: _rowKey, status: _status, ...rest }) => rest);

  const handleApply = async () => {
    setApplying(true);
    setError(undefined);
    try {
      await onApply({
        services: completeServices.length > 0 ? completeServices : undefined,
        checks: completeChecks.length > 0 ? completeChecks : undefined,
        ci: ci?.repo.trim() ? ci : undefined,
      });
    } catch (err) {
      setError((err as Error).message);
      setApplying(false);
    }
  };

  const isReScan = (current?.services?.length ?? 0) > 0 || (current?.checks?.length ?? 0) > 0;

  return (
    <Modal
      open
      onClose={applying ? () => {} : onCancel}
      size="large"
      title={isReScan ? 'Re-scan proposal' : 'Desk discovery proposal'}
    >
      <div className="flex flex-col gap-5">
        <p className="text-sm m-0 opacity-70">
          {isReScan
            ? 'The discovery agent produced the proposal below against your current desk config. Edit anything you want to keep, then apply — removals happen only when you leave them in the list and apply.'
            : 'The discovery agent scanned the project and produced the desk block below. Edit anything you want to keep, then apply.'}
        </p>

        <Section
          title="Services"
          summary={
            <>
              {diff.services.filter((s) => s.kind === 'added').length > 0 && (
                <Stamp size="small" variant="success">
                  +{diff.services.filter((s) => s.kind === 'added').length} new
                </Stamp>
              )}
              {diff.services.filter((s) => s.kind === 'changed').length > 0 && (
                <Stamp size="small" variant="info">
                  ~{diff.services.filter((s) => s.kind === 'changed').length} changed
                </Stamp>
              )}
              {diff.services.filter((s) => s.kind === 'removed').length > 0 && (
                <Stamp size="small" variant="error">
                  -{diff.services.filter((s) => s.kind === 'removed').length} to remove
                </Stamp>
              )}
            </>
          }
          onAdd={addService}
        >
          {services.length === 0 && (
            <p className="opacity-[0.45] text-sm m-0">No services in the proposal.</p>
          )}
          {services.map((service, idx) => {
            const stamp = stampFor(service.status);
            return (
              <div
                key={service.rowKey}
                className={service.status === 'removed' ? 'opacity-60' : ''}
              >
                <div className="flex items-end gap-3 pb-2 pt-2">
                  <Stamp size="small" variant={stamp.variant}>
                    {stamp.label}
                  </Stamp>
                  <Input
                    size="small"
                    label="Name"
                    value={service.name}
                    onChange={(e) => updateService(service.rowKey, { name: e.target.value })}
                  />
                  <Input
                    size="small"
                    label="Command"
                    value={service.cmd}
                    onChange={(e) => updateService(service.rowKey, { cmd: e.target.value })}
                  />
                  <Input
                    size="small"
                    type="number"
                    label="Port"
                    className="w-[100px]"
                    value={service.port ?? ''}
                    onChange={(e) =>
                      updateService(service.rowKey, {
                        port: e.target.value ? Number(e.target.value) : undefined,
                      })
                    }
                  />
                  <Input
                    size="small"
                    label="Healthcheck URL"
                    value={service.healthcheck ?? ''}
                    onChange={(e) =>
                      updateService(service.rowKey, {
                        healthcheck: e.target.value || undefined,
                      })
                    }
                  />
                  <IconButton
                    icon={<CloseIcon size={16} />}
                    variant="danger"
                    size="small"
                    onClick={() => removeService(service.rowKey)}
                    label={`Remove ${service.name || 'service'}`}
                  />
                </div>
                {idx < services.length - 1 && <Divider />}
              </div>
            );
          })}
        </Section>

        <Section
          title="Checks"
          summary={
            <>
              {diff.checks.filter((c) => c.kind === 'added').length > 0 && (
                <Stamp size="small" variant="success">
                  +{diff.checks.filter((c) => c.kind === 'added').length} new
                </Stamp>
              )}
              {diff.checks.filter((c) => c.kind === 'changed').length > 0 && (
                <Stamp size="small" variant="info">
                  ~{diff.checks.filter((c) => c.kind === 'changed').length} changed
                </Stamp>
              )}
              {diff.checks.filter((c) => c.kind === 'removed').length > 0 && (
                <Stamp size="small" variant="error">
                  -{diff.checks.filter((c) => c.kind === 'removed').length} to remove
                </Stamp>
              )}
            </>
          }
          onAdd={addCheck}
        >
          {checks.length === 0 && (
            <p className="opacity-[0.45] text-sm m-0">No checks in the proposal.</p>
          )}
          {checks.map((check, idx) => {
            const stamp = stampFor(check.status);
            return (
              <div key={check.rowKey} className={check.status === 'removed' ? 'opacity-60' : ''}>
                <div className="flex items-end gap-3 pb-2 pt-2">
                  <Stamp size="small" variant={stamp.variant}>
                    {stamp.label}
                  </Stamp>
                  <Input
                    size="small"
                    label="Name"
                    value={check.name}
                    onChange={(e) => updateCheck(check.rowKey, { name: e.target.value })}
                  />
                  <Input
                    size="small"
                    label="Command"
                    value={check.cmd}
                    onChange={(e) => updateCheck(check.rowKey, { cmd: e.target.value })}
                  />
                  <IconButton
                    icon={<CloseIcon size={16} />}
                    variant="danger"
                    size="small"
                    onClick={() => removeCheck(check.rowKey)}
                    label={`Remove ${check.name || 'check'}`}
                  />
                </div>
                {idx < checks.length - 1 && <Divider />}
              </div>
            );
          })}
        </Section>

        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="m-0 text-sm font-semibold">CI</h3>
            {diff.ci && (
              <Stamp
                size="small"
                variant={
                  diff.ci.kind === 'added'
                    ? 'success'
                    : diff.ci.kind === 'changed'
                      ? 'info'
                      : 'error'
                }
              >
                {diff.ci.kind === 'added'
                  ? 'new'
                  : diff.ci.kind === 'changed'
                    ? 'changed'
                    : 'to remove'}
              </Stamp>
            )}
          </div>
          {!ci && <p className="opacity-[0.45] text-sm m-0">No CI in the proposal.</p>}
          {ci && (
            <div className="flex items-end gap-3 pb-2 pt-2">
              <Input
                size="small"
                label="Repo (owner/name)"
                value={ci.repo}
                onChange={(e) => setCi({ ...ci, repo: e.target.value })}
              />
              <Input
                size="small"
                label="Branch"
                value={ci.branch ?? ''}
                onChange={(e) => setCi({ ...ci, branch: e.target.value || undefined })}
              />
            </div>
          )}
        </div>

        {error && <p className="text-sm m-0 opacity-80">Failed to apply: {error}</p>}

        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="small" onClick={onCancel} disabled={applying}>
            Cancel
          </Button>
          <Button size="small" onClick={handleApply} disabled={applying}>
            {applying ? 'Applying…' : 'Apply'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

interface SectionProps {
  title: string;
  summary: React.ReactNode;
  onAdd: () => void;
  children: React.ReactNode;
}

const Section = ({ title, summary, onAdd, children }: SectionProps) => (
  <div>
    <div className="flex items-center justify-between mb-2">
      <div className="flex items-center gap-2">
        <h3 className="m-0 text-sm font-semibold">{title}</h3>
        <div className="flex items-center gap-1">{summary}</div>
      </div>
      <Button size="small" variant="ghost" onClick={onAdd}>
        + Add
      </Button>
    </div>
    {children}
  </div>
);
