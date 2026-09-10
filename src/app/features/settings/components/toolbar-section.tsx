import { RowSkeleton } from '@/app/components';
import { Alert, Card, Divider, Input, Stamp, Switch } from '@dendelion/paper-ui';
import { useToolbarSection } from '../hooks';

export const ToolbarSection = () => {
  const { config, hostState, routeInput, setRouteInput, handleToggleEnabled, handleSaveRoute } =
    useToolbarSection();

  return (
    <div>
      <div className="mb-6">
        <h2 className="m-0">Toolbar</h2>
        <p className="opacity-50 mt-1">
          Injects the in-app dev toolbar into this project's Vite dev server via the{' '}
          <code>@dendelion/paper-camp/vite</code> plugin, mounted at <code>/p/&lt;slug&gt;</code> on
          the daemon.
        </p>
      </div>
      {config === undefined && <RowSkeleton />}
      {config === null && (
        <Alert variant="warning">
          No papercamp/config.json found — run <code>paper-camp init</code> in this directory first.
        </Alert>
      )}
      {config && (
        <Card size="small" texture="kraft">
          <div className="flex items-center justify-between gap-3 pb-3">
            <div>
              <p className="m-0">Enable</p>
              <p className="opacity-[0.45] text-sm mt-1 mx-0 mb-0">
                Off skips the plugin entirely, even in a registered repo.
              </p>
            </div>
            <Switch
              checked={config.integration?.toolbar?.enabled ?? true}
              onChange={handleToggleEnabled}
            />
          </div>
          <Divider />

          <div className="flex items-end gap-3 pb-3 pt-3">
            <Input
              value={routeInput}
              onChange={(e) => setRouteInput(e.target.value)}
              onBlur={handleSaveRoute}
              label="Route"
              placeholder="/paper-camp"
            />
          </div>
          <Divider />

          <div className="pb-1 pt-3">
            <p className="m-0">Host app</p>
            <p className="opacity-[0.45] text-sm mt-1 mx-0 mb-0">
              What the frontend service's Vite config looks like today.
            </p>
          </div>
          {hostState === undefined && <RowSkeleton />}
          {hostState === null && <Alert variant="warning">Failed to inspect the host app.</Alert>}
          {hostState && (
            <div className="flex flex-col gap-2 pt-3">
              <div className="flex items-center gap-3">
                <span className="flex-1">Vite config</span>
                <Stamp size="small" variant={hostState.viteConfigPath ? 'success' : 'error'}>
                  {hostState.viteConfigPath ?? 'Not found'}
                </Stamp>
              </div>
              <div className="flex items-center gap-3">
                <span className="flex-1">Imports the plugin</span>
                <Stamp size="small" variant={hostState.importsPlugin ? 'success' : 'warning'}>
                  {hostState.importsPlugin ? 'Yes' : 'No'}
                </Stamp>
              </div>
              <div className="flex items-center gap-3">
                <span className="flex-1">Package dependency</span>
                <Stamp size="small" variant={hostState.isDependency ? 'success' : 'warning'}>
                  {hostState.isDependency ? 'Yes' : 'No'}
                </Stamp>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
};
