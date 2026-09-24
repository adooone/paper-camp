import { RowSkeleton } from '@/app/components';
import { Alert, Button, Input, SettingGroup, SettingRow, Stamp, Switch } from '@dendelion/paper-ui';
import { color } from '@dendelion/paper-ui/tokens';
import { SettingsHeader } from '../components/settings-header';
import { VERSION_STAMP_FILL } from '../constants';
import { useSettingsPage } from '../hooks';
import { AgentTaskTable } from './agent-task-table';

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
    handleSaveName,
    handleToggleToolbar,
    handleFile,
  } = useSettingsPage();

  return (
    <div>
      <SettingsHeader title="Project Info">
        {config && (
          <>
            <Stamp size="small" fillColor={VERSION_STAMP_FILL} textColor={color.accentGreenDark}>
              v{config.version}
            </Stamp>
            <span className="font-handwritten text-sm opacity-50 whitespace-nowrap">
              Initialized {new Date(config.initializedAt).toLocaleString()}
            </span>
          </>
        )}
      </SettingsHeader>

      {config === undefined && <RowSkeleton boxless />}
      {config === null && (
        <Alert variant="warning">
          No papercamp/config.json found — run <code>paper-camp init</code> in this directory first.
        </Alert>
      )}
      {config && (
        <div className="flex flex-col gap-1">
          <SettingRow
            label="Project name"
            control={
              <Input
                size="small"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onBlur={handleSaveName}
              />
            }
          />

          <SettingRow
            label="Icon"
            control={
              <div className="flex flex-col items-end gap-1">
                <div className="flex items-center gap-2">
                  {iconDataUri && (
                    <img
                      src={iconDataUri}
                      alt="Project icon"
                      className="w-8 h-8 object-contain shrink-0 rounded"
                    />
                  )}
                  {/* paper-ui has no file-input component, so this raw input is intentional */}
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".svg,.png,.jpg,.jpeg,.gif,.webp"
                    onChange={handleFile}
                    className="hidden"
                  />
                  <Button
                    size="small"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                  >
                    {uploading ? 'Uploading…' : 'Choose file'}
                  </Button>
                </div>
                {identityLoading && <span className="text-sm opacity-50">Loading…</span>}
                {!identityLoading && !iconDataUri && !uploading && (
                  <span className="text-sm opacity-[0.45]">No icon set.</span>
                )}
              </div>
            }
          />

          <SettingRow
            label="Port"
            hint="Default for `paper-camp dev`. Restart the server to apply a change."
            control={
              <Input
                size="small"
                type="number"
                value={portInput}
                onChange={(e) => setPortInput(e.target.value)}
                onBlur={handleSavePort}
              />
            }
          />

          <SettingRow
            label="In-app dev toolbar"
            control={
              <Switch
                size="small"
                checked={config.integration?.toolbar?.enabled ?? true}
                onChange={handleToggleToolbar}
              />
            }
          />

          <SettingGroup title="Default agents">
            <AgentTaskTable defaultAgents={config.defaultAgents} onSave={handleSaveAgentConfig} />
          </SettingGroup>
        </div>
      )}
    </div>
  );
};
