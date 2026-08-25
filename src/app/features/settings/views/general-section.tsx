import { color } from '@/app/styles/tokens';
import { DEFAULT_AGENTS } from '@/types/index';
import { Alert, Button, Card, Divider, Input, Stamp } from '@dendelion/paper-ui';
import { TASK_TYPE_KEYS, VERSION_STAMP_FILL } from '../constants';
import { useSettingsPage } from '../hooks';
import { AgentTaskRow } from './agent-task-row';
import { AgentTaskRowHeader } from './agent-task-row-header';

export const GeneralSection = () => {
  const {
    fileRef,
    config,
    identityLoading,
    iconDataUri,
    uploading,
    portInput,
    setPortInput,
    nameInput,
    setNameInput,
    handleSaveAgentConfig,
    handleSavePort,
    handleToggleIntegration,
    handleSaveName,
    handleFile,
  } = useSettingsPage();

  return (
    <div>
      <div className="mb-6">
        <h2 className="m-0">Project Info</h2>
      </div>
      {config === undefined && <p>Loading…</p>}
      {config === null && (
        <Alert variant="warning">
          No papercamp/config.json found — run <code>paper-camp init</code> in this directory first.
        </Alert>
      )}
      {config && (
        <Card size="small" texture="kraft">
          <div className="flex items-end gap-3 pb-3">
            <Input
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onBlur={handleSaveName}
              label="Project Name"
            />
            <Stamp size="small" fillColor={VERSION_STAMP_FILL} textColor={color.accentGreenDark}>
              v{config.version}
            </Stamp>
          </div>
          <Divider />

          <div className="flex items-center gap-3 pb-3 pt-3">
            {iconDataUri && (
              <img
                src={iconDataUri}
                alt="Project icon"
                className="w-10 h-10 object-contain shrink-0 rounded"
              />
            )}
            <div>
              {/* paper-ui has no file-input component, so this raw input is intentional */}
              <input
                ref={fileRef}
                type="file"
                accept=".svg,.png,.jpg,.jpeg,.gif,.webp"
                onChange={handleFile}
                className="hidden"
              />
              <Button size="small" onClick={() => fileRef.current?.click()} disabled={uploading}>
                {uploading ? 'Uploading…' : 'Choose File'}
              </Button>
              {identityLoading && <p className="text-sm opacity-50 mt-1 mx-0 mb-0">Loading…</p>}
              {!identityLoading && !iconDataUri && !uploading && (
                <p className="text-sm opacity-[0.45] mt-1 mx-0 mb-0">No icon set.</p>
              )}
            </div>
          </div>
          <Divider />

          <div className="flex items-end gap-3 pb-3 pt-3">
            <Input
              type="number"
              value={portInput}
              onChange={(e) => setPortInput(e.target.value)}
              onBlur={handleSavePort}
              label="Port"
              helperText="Default for `paper-camp dev`. Restart the server to apply a change."
            />
          </div>
          <Divider />

          <div className="flex items-center justify-between gap-3 pb-3 pt-3">
            <div>
              <p className="m-0">In-app dev toolbar</p>
              <p className="opacity-[0.45] text-sm mt-1 mx-0 mb-0">
                Inject the paper-camp toolbar into this project's dev server via the Vite plugin.
              </p>
            </div>
            <Button size="small" onClick={handleToggleIntegration}>
              {(config.integration?.toolbar?.enabled ?? true) ? 'Disable' : 'Enable'}
            </Button>
          </div>
          <Divider />

          <AgentTaskRowHeader />
          {TASK_TYPE_KEYS.map((key, idx) => (
            <AgentTaskRow
              key={key}
              taskKey={key}
              agentConfig={config.defaultAgents?.[key] ?? DEFAULT_AGENTS[key]}
              isLast={idx === TASK_TYPE_KEYS.length - 1}
              onSave={handleSaveAgentConfig}
              authorConfig={
                key === 'codeReview'
                  ? (config.defaultAgents?.phase ?? DEFAULT_AGENTS.phase)
                  : undefined
              }
            />
          ))}
        </Card>
      )}

      <p className="opacity-[0.45] text-sm mt-4">
        <strong>Initialized:</strong>{' '}
        {config ? new Date(config.initializedAt).toLocaleString() : '—'}
      </p>
    </div>
  );
};
