import { connectService, fetchConfig, fetchConnections, saveConfig } from '@/app/services/system';
import { useAppStore } from '@/app/stores/app-store';
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
import { useCallback, useEffect, useRef, useState } from 'react';

const RELAY_POLL_MS = 2000;

// Only claude-code exposes `auth login`/`auth status` (see agentAuthenticated in server/services.ts).
const RELAY_CONNECTION_ID: ConnectionResult['id'] = 'agent:claude-code';

// Same two commands the relay drives interactively — shown as copy-paste fallback
// when the relay itself can't run (no PTY, offline, unsupported CLI version).
const AUTH_FIX_COMMANDS = ['claude auth login', 'claude setup-token'] as const;

const RelayFallbackGuide = () => (
  <div className="mt-2 flex flex-col gap-2">
    <p className="opacity-[0.65] text-sm m-0">
      The in-app relay couldn't complete. Run one of these in a terminal instead:
    </p>
    {AUTH_FIX_COMMANDS.map((cmd) => (
      <CodeBlock key={cmd} code={cmd} />
    ))}
    <p className="opacity-50 text-sm m-0">
      {/* paper-ui has no inline-code component, only the block-level CodeBlock */}
      Alternatively, set <code>ANTHROPIC_API_KEY</code> in the server's environment — that bills as
      API usage rather than your Max subscription, so treat it as a fallback, not the default.
    </p>
  </div>
);

const SignInAction = ({ onSignedIn }: { onSignedIn: () => void }) => {
  const loginRelay = useAppStore((s) => s.loginRelay);
  const startLoginRelay = useAppStore((s) => s.startLoginRelay);
  const loadLoginRelayStatus = useAppStore((s) => s.loadLoginRelayStatus);
  const cancelLoginRelay = useAppStore((s) => s.cancelLoginRelay);
  const { toast } = useToast();
  const openedUrlRef = useRef<string | null>(null);
  const phase = loginRelay?.phase;

  useEffect(() => {
    if (phase !== 'starting' && phase !== 'awaiting-authorization') return;
    const id = window.setInterval(() => loadLoginRelayStatus(), RELAY_POLL_MS);
    return () => window.clearInterval(id);
  }, [phase, loadLoginRelayStatus]);

  useEffect(() => {
    const url = loginRelay?.authorizeUrl;
    if (phase !== 'awaiting-authorization' || !url || openedUrlRef.current === url) return;
    openedUrlRef.current = url;
    window.open(url, '_blank', 'noopener,noreferrer');
  }, [phase, loginRelay?.authorizeUrl]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed on phase transitions only — toast/onSignedIn aren't stable across renders, and including them would refire on every relay poll
  useEffect(() => {
    if (phase === 'success') {
      toast({ title: 'Signed in', variant: 'success' });
      onSignedIn();
    } else if (phase === 'error') {
      toast({ title: 'Sign-in failed', description: loginRelay?.error, variant: 'error' });
    }
  }, [phase]);

  if (phase === 'starting') {
    return (
      <Button size="small" disabled>
        Starting…
      </Button>
    );
  }
  if (phase === 'awaiting-authorization') {
    return (
      <div className="flex items-center gap-2">
        <Button
          size="small"
          onClick={() =>
            loginRelay?.authorizeUrl &&
            window.open(loginRelay.authorizeUrl, '_blank', 'noopener,noreferrer')
          }
        >
          Reopen sign-in tab
        </Button>
        <Button size="small" onClick={() => cancelLoginRelay()}>
          Cancel
        </Button>
      </div>
    );
  }
  return (
    <div>
      <Button size="small" onClick={() => startLoginRelay()}>
        Sign in
      </Button>
      {phase === 'error' && <RelayFallbackGuide />}
    </div>
  );
};

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
          {connection.id === RELAY_CONNECTION_ID && connection.authenticated === false ? (
            <SignInAction onSignedIn={() => onRecheck(connection.id)} />
          ) : (
            <ConnectActionView
              connection={connection}
              onConnect={onConnect}
              connecting={connecting}
            />
          )}
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
  const externalConnections = connections?.filter((c) => c.kind === 'external') ?? [];
  const localConnections = connections?.filter((c) => c.kind === 'local') ?? [];

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
