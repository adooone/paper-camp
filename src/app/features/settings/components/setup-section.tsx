import { Alert, Button, Card } from '@dendelion/paper-ui';
import { useSetupSection } from '../hooks';
import { ConnectionRow } from './connection-row';

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
      <div className="mb-6">
        <h2 className="m-0">Setup</h2>
      </div>
      {connections === null && !loadFailed && <p>Loading…</p>}
      {loadFailed && (
        <div className="mb-4">
          <Alert variant="warning">Failed to load connections. Try refreshing.</Alert>
        </div>
      )}
      {connections && (
        <>
          {!allOk && (
            <div className="mb-4">
              <Alert variant="warning">
                Some connections are incomplete — features that depend on them stay disabled until
                fixed. Run the connect command below, then recheck.
              </Alert>
            </div>
          )}
          {externalConnections.length > 0 && (
            <div className="mb-4">
              <p className="opacity-[0.45] text-sm mt-0 mb-2">
                External services — reached on your behalf with their own remote credential.
              </p>
              <Card size="small" texture="kraft">
                {externalConnections.map((c, idx) => (
                  <ConnectionRow
                    key={c.id}
                    connection={c}
                    isLast={idx === externalConnections.length - 1}
                    onRecheck={handleRecheck}
                    rechecking={reloadingId === c.id}
                    onConnect={handleConnect}
                    connecting={connectingId === c.id}
                  />
                ))}
              </Card>
            </div>
          )}
          {localConnections.length > 0 && (
            <div className="mb-4">
              <p className="opacity-[0.45] text-sm mt-0 mb-2">
                Local adapters — driven on this machine with their own local session.
              </p>
              <Card size="small" texture="kraft">
                {localConnections.map((c, idx) => (
                  <ConnectionRow
                    key={c.id}
                    connection={c}
                    isLast={idx === localConnections.length - 1}
                    onRecheck={handleRecheck}
                    rechecking={reloadingId === c.id}
                    onConnect={handleConnect}
                    connecting={connectingId === c.id}
                  />
                ))}
              </Card>
            </div>
          )}
          <div className="mt-4">
            <Button size="small" onClick={handleDismissToggle}>
              {setupDismissed ? 'Show Setup on open again' : "Don't show Setup on open"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
};
