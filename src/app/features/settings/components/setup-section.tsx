import { RowSkeleton } from '@/app/components';
import { Alert, SettingGroup, SettingRow, Switch } from '@dendelion/paper-ui';
import { useSetupSection } from '../hooks';
import { ConnectionRow } from './connection-row';
import { SettingsHeader } from './settings-header';

export const SetupSection = () => {
  const {
    connections,
    loadFailed,
    reloadingId,
    connectingId,
    setupDismissed,
    handleRecheck,
    handleConnect,
    handleDismissToggle,
    allOk,
    externalConnections,
    localConnections,
  } = useSetupSection();

  return (
    <div>
      <SettingsHeader title="Setup" />

      {connections === null && !loadFailed && <RowSkeleton boxless />}
      {loadFailed && <Alert variant="warning">Failed to load connections. Try refreshing.</Alert>}
      {connections && (
        <div className="flex flex-col gap-1">
          {!allOk && (
            <Alert variant="warning">
              Some connections are incomplete — features that depend on them stay disabled until
              fixed. Run the connect command below, then recheck.
            </Alert>
          )}
          {externalConnections.length > 0 && (
            <SettingGroup title="External services">
              {externalConnections.map((c) => (
                <ConnectionRow
                  key={c.id}
                  connection={c}
                  onRecheck={handleRecheck}
                  rechecking={reloadingId === c.id}
                  onConnect={handleConnect}
                  connecting={connectingId === c.id}
                />
              ))}
            </SettingGroup>
          )}
          {localConnections.length > 0 && (
            <SettingGroup title="Local adapters">
              {localConnections.map((c) => (
                <ConnectionRow
                  key={c.id}
                  connection={c}
                  onRecheck={handleRecheck}
                  rechecking={reloadingId === c.id}
                  onConnect={handleConnect}
                  connecting={connectingId === c.id}
                />
              ))}
            </SettingGroup>
          )}
          <SettingRow
            label="Show Setup on open"
            control={
              <Switch size="small" checked={!setupDismissed} onChange={handleDismissToggle} />
            }
          />
        </div>
      )}
    </div>
  );
};
