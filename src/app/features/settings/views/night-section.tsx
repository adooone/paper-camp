import { EmptyState, RowSkeleton } from '@/app/components';
import { Alert, Button, Card, Divider, PlusIcon, Switch } from '@dendelion/paper-ui';
import { useNightSection } from '../hooks/use-night-section';
import { NightCustomCheckRow } from './night-custom-check-row';

export const NightSection = () => {
  const {
    config,
    status,
    customChecks,
    running,
    builtinChecks,
    handleToggleEnabled,
    handleTogglePause,
    handleRunNow,
    handleToggleCheck,
    addCustomCheck,
    updateCustomCheck,
    removeCustomCheck,
  } = useNightSection();

  const enabled = status?.enabled ?? false;
  const paused = (status?.pausedUntil ?? null) !== null;

  return (
    <div>
      <div className="mb-6">
        <h2 className="m-0">Night shift</h2>
        <p className="opacity-50 mt-1">
          Runs read-only health reviews against this project while the machine is otherwise idle.
        </p>
      </div>
      {(config === undefined || status === undefined) && <RowSkeleton />}
      {config === null && (
        <Alert variant="warning">
          No papercamp/config.json found — run <code>paper-camp init</code> in this directory first.
        </Alert>
      )}
      {config && status && (
        <>
          <Card size="small" texture="kraft">
            <div className="flex items-center justify-between gap-3 pb-3">
              <div>
                <p className="m-0">Run the night shift for this project</p>
                <p className="opacity-[0.45] text-sm mt-1 mx-0 mb-0">
                  Only one project on this machine runs it at a time.
                </p>
              </div>
              <Switch checked={enabled} onChange={handleToggleEnabled} />
            </div>
            <Divider />

            <div className="flex items-center justify-between gap-3 pb-3 pt-3">
              <div>
                <p className="m-0">Pause tonight</p>
                <p className="opacity-[0.45] text-sm mt-1 mx-0 mb-0">
                  Skips passes until the next rate-limit reset.
                </p>
              </div>
              <Switch checked={paused} onChange={handleTogglePause} disabled={!enabled} />
            </div>
            <Divider />

            <div className="flex items-center justify-between gap-3 pt-3">
              <div>
                <p className="m-0">Run a pass now</p>
                <p className="opacity-[0.45] text-sm mt-1 mx-0 mb-0">
                  Reviews the highest-scoring chunk immediately, gate or not.
                </p>
              </div>
              <Button size="small" onClick={handleRunNow} disabled={!enabled || running}>
                {running ? 'Starting…' : 'Run a pass now'}
              </Button>
            </div>
          </Card>

          <div className="mt-6 mb-3">
            <h3 className="m-0">Checks</h3>
          </div>
          <Card size="small" texture="kraft">
            {builtinChecks.map((check, idx) => (
              <div key={check.id}>
                <div className="flex items-center justify-between gap-3 pb-2 pt-2">
                  <span>{check.name}</span>
                  <Switch
                    checked={(config.night?.checks?.[check.id] ?? true) !== false}
                    onChange={() => handleToggleCheck(check.id)}
                  />
                </div>
                {idx < builtinChecks.length - 1 && <Divider />}
              </div>
            ))}
          </Card>

          <div className="mt-6 flex items-center justify-between mb-3">
            <h3 className="m-0">Custom checks</h3>
            <Button size="small" icon={<PlusIcon size={16} />} onClick={addCustomCheck}>
              Add check
            </Button>
          </div>
          <Card size="small" texture="kraft">
            {customChecks.length === 0 && <EmptyState message="No custom checks yet." />}
            {customChecks.map((check, idx) => (
              <NightCustomCheckRow
                key={check.id}
                check={check}
                onSave={(next) => updateCustomCheck(check.id, next)}
                onRemove={() => removeCustomCheck(check.id)}
                isLast={idx === customChecks.length - 1}
              />
            ))}
          </Card>
        </>
      )}
    </div>
  );
};
