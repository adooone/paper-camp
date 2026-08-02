import { connectService, fetchConfig, fetchConnections, saveConfig } from '@/app/services/system';
import type { CapabilityStatus, ConnectionResult } from '@/types/index';
import {
  Alert,
  Button,
  Card,
  CodeBlock,
  Divider,
  Stamp,
  Tooltip,
  useToast,
} from '@dendelion/paper-ui';
import { useCallback, useEffect, useState } from 'react';

const STATUS_STAMP: Record<CapabilityStatus, { fill: string; text: string; label: string }> = {
  ok: { fill: 'rgba(143, 185, 150, 0.25)', text: '#5E8A66', label: 'Ready' },
  warn: { fill: 'rgba(212, 163, 115, 0.25)', text: '#A67B4F', label: 'Needs attention' },
  missing: { fill: 'rgba(201, 139, 139, 0.25)', text: '#6E3A3A', label: 'Missing' },
};

const ConnectActionView = ({
  connection,
  onConnect,
  connecting,
}: {
  connection: ConnectionResult;
  onConnect: (id: string) => void;
  connecting: boolean;
}) => {
  const { connect } = connection;
  if (!connect) return null;
  if (connect.kind === 'command' && connect.runnable) {
    return (
      <Button size="small" onClick={() => onConnect(connection.id)} disabled={connecting}>
        {connecting ? 'Running…' : `Run \`${connect.command}\``}
      </Button>
    );
  }
  if (connect.kind === 'command') {
    return (
      <div className="mt-2">
        <CodeBlock code={connect.command} />
      </div>
    );
  }
  if (connect.kind === 'link') {
    return (
      <Button
        size="small"
        onClick={() => window.open(connect.url, '_blank', 'noopener,noreferrer')}
      >
        {connect.label}
      </Button>
    );
  }
  return <p className="opacity-[0.65] text-sm mt-2 mx-0 mb-0">{connect.message}</p>;
};

const ConnectionRow = ({
  connection,
  isLast,
  onRecheck,
  rechecking,
  onConnect,
  connecting,
}: {
  connection: ConnectionResult;
  isLast: boolean;
  onRecheck: (id: string) => void;
  rechecking: boolean;
  onConnect: (id: string) => void;
  connecting: boolean;
}) => {
  const stamp = STATUS_STAMP[connection.status];
  return (
    <>
      <div className="pb-3 pt-3">
        <div className="flex items-center gap-3">
          <span className="flex-1 font-medium">{connection.label}</span>
          {connection.authenticated === false && (
            <Tooltip content="Installed, but not signed in">
              <Stamp size="small" variant="warning">
                Not signed in
              </Stamp>
            </Tooltip>
          )}
          <Stamp size="small" fillColor={stamp.fill} textColor={stamp.text}>
            {stamp.label}
          </Stamp>
          <Button size="small" onClick={() => onRecheck(connection.id)} disabled={rechecking}>
            {rechecking ? 'Checking…' : 'Recheck'}
          </Button>
        </div>
        <p className="opacity-[0.65] text-sm mt-1 mx-0 mb-0">Unlocks: {connection.unlocks}</p>
        <p className="opacity-50 text-sm mt-1 mx-0 mb-0">{connection.detail}</p>
        <div className="mt-2">
          <ConnectActionView
            connection={connection}
            onConnect={onConnect}
            connecting={connecting}
          />
        </div>
      </div>
      {!isLast && <Divider />}
    </>
  );
};

export const SetupSection = () => {
  const [connections, setConnections] = useState<ConnectionResult[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [reloadingId, setReloadingId] = useState<string | null>(null);
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [setupDismissed, setSetupDismissed] = useState(false);
  const { toast } = useToast();

  const applyConnections = useCallback((result: ConnectionResult[] | null) => {
    if (result === null) {
      setLoadFailed(true);
      return;
    }
    setLoadFailed(false);
    setConnections(result);
  }, []);

  useEffect(() => {
    fetchConnections().then(applyConnections);
    fetchConfig().then((c) => setSetupDismissed(c?.setupDismissed ?? false));
  }, [applyConnections]);

  const handleRecheck = async (id: string) => {
    setReloadingId(id);
    applyConnections(await fetchConnections());
    setReloadingId(null);
  };

  const handleConnect = async (id: string) => {
    setConnectingId(id);
    const updated = await connectService(id);
    if (updated) {
      setConnections((prev) => prev?.map((c) => (c.id === id ? updated : c)) ?? prev);
    } else {
      toast({ title: 'Failed to connect', variant: 'error' });
    }
    setConnectingId(null);
  };

  const handleDismissToggle = async () => {
    const next = !setupDismissed;
    const { ok } = await saveConfig({ setupDismissed: next });
    if (ok) {
      setSetupDismissed(next);
      toast({ title: 'Saved', variant: 'success' });
    } else {
      toast({ title: 'Failed to save', variant: 'error' });
    }
  };

  const allOk = connections?.every((c) => c.status === 'ok') ?? true;

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
          <Card size="small" texture="kraft">
            {connections.map((c, idx) => (
              <ConnectionRow
                key={c.id}
                connection={c}
                isLast={idx === connections.length - 1}
                onRecheck={handleRecheck}
                rechecking={reloadingId === c.id}
                onConnect={handleConnect}
                connecting={connectingId === c.id}
              />
            ))}
          </Card>
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
