import {
  pollGithubDeviceToken,
  startGithubDeviceFlow,
} from '@/app/services/github-device-flow-api';
import { GithubApiError } from '@/app/services/github/client';
import {
  clearHubGithubToken,
  readHubGithubToken,
  writeHubGithubToken,
} from '@/app/services/github/hub-token-store';
import {
  type GithubIdentity,
  fetchAccessibleRepoNames,
  fetchGithubIdentity,
} from '@/app/services/github/identity';
import { Button, Card, CopyButton, Input, ListItem } from '@dendelion/paper-ui';
import { useEffect, useRef, useState } from 'react';

const GITHUB_TOKEN_MINT_URL = 'https://github.com/settings/personal-access-tokens/new';

interface Connection {
  identity: GithubIdentity;
  repoNames: string[];
}

async function connect(token: string): Promise<Connection> {
  const [identity, repoNames] = await Promise.all([
    fetchGithubIdentity(token),
    fetchAccessibleRepoNames(token),
  ]);
  return { identity, repoNames };
}

function connectErrorMessage(error: unknown): string {
  if (error instanceof GithubApiError) return error.message;
  return 'Could not reach GitHub.';
}

interface DeviceFlowState {
  userCode: string;
  deviceCode: string;
  verificationUri: string;
}

interface DeviceFlowCardProps {
  state: DeviceFlowState;
  error: string | null;
  onCancel: () => void;
}

const DeviceFlowCard = ({ state, error, onCancel }: DeviceFlowCardProps) => (
  <Card size="small" texture="kraft" className="flex flex-1 flex-col gap-2 text-left">
    <p className="m-0 font-semibold">Sign in with GitHub</p>
    <p className="m-0 text-sm opacity-70">Enter this code on the GitHub tab that just opened:</p>
    <p className="m-0 flex items-center gap-2 text-lg font-semibold tracking-widest">
      {state.userCode}
      <CopyButton text={state.userCode} />
    </p>
    {error && <p className="m-0 text-watercolor-rose-dark text-sm">{error}</p>}
    <Button size="small" variant="secondary" onClick={onCancel}>
      Cancel
    </Button>
  </Card>
);

interface ConnectedGithubProps {
  connection: Connection;
  onDisconnect: () => void;
}

const ConnectedGithub = ({ connection, onDisconnect }: ConnectedGithubProps) => (
  <Card size="small" texture="kraft" className="flex flex-1 flex-col gap-2 text-left">
    <p className="m-0 font-semibold">Connected as {connection.identity.login}</p>
    <p className="m-0 text-sm opacity-70">
      {connection.repoNames.length === 0
        ? 'This token reaches no repositories yet.'
        : `Reaches ${connection.repoNames.length} ${connection.repoNames.length === 1 ? 'repository' : 'repositories'}:`}
    </p>
    {connection.repoNames.length > 0 && (
      <div className="flex flex-col gap-1">
        {connection.repoNames.map((repoName) => (
          <ListItem key={repoName} size="small">
            {repoName}
          </ListItem>
        ))}
      </div>
    )}
    <Button size="small" variant="secondary" onClick={onDisconnect}>
      Disconnect
    </Button>
  </Card>
);

export const GithubConnectCard = () => {
  const [token, setToken] = useState('');
  const [connection, setConnection] = useState<Connection | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deviceFlow, setDeviceFlow] = useState<DeviceFlowState | null>(null);
  const [deviceFlowLoading, setDeviceFlowLoading] = useState(false);
  const activeDeviceCodeRef = useRef<string | null>(null);

  useEffect(() => {
    const stored = readHubGithubToken();
    if (!stored) return;
    setLoading(true);
    connect(stored)
      .then((next) => setConnection(next))
      .catch(() => {
        clearHubGithubToken();
        setError('That token no longer works — reconnect below.');
      })
      .finally(() => setLoading(false));
  }, []);

  const handleConnect = () => {
    const trimmedToken = token.trim();
    if (trimmedToken === '') return;
    setLoading(true);
    setError(null);
    connect(trimmedToken)
      .then((next) => {
        writeHubGithubToken(trimmedToken);
        setConnection(next);
        setToken('');
      })
      .catch((connectError) => setError(connectErrorMessage(connectError)))
      .finally(() => setLoading(false));
  };

  const handleDisconnect = () => {
    clearHubGithubToken();
    setConnection(null);
    setError(null);
  };

  const pollDeviceToken = async (deviceCode: string, intervalSeconds: number) => {
    await new Promise((resolve) => setTimeout(resolve, intervalSeconds * 1000));
    if (activeDeviceCodeRef.current !== deviceCode) return;
    const result = await pollGithubDeviceToken(deviceCode);
    if (activeDeviceCodeRef.current !== deviceCode) return;

    if (result.access_token) {
      activeDeviceCodeRef.current = null;
      writeHubGithubToken(result.access_token);
      try {
        setConnection(await connect(result.access_token));
      } catch (connectError) {
        setError(connectErrorMessage(connectError));
      }
      setDeviceFlow(null);
      return;
    }
    if (result.error === 'authorization_pending') {
      await pollDeviceToken(deviceCode, intervalSeconds);
      return;
    }
    if (result.error === 'slow_down') {
      await pollDeviceToken(deviceCode, result.interval ?? intervalSeconds + 5);
      return;
    }

    activeDeviceCodeRef.current = null;
    setDeviceFlow(null);
    setError(result.error_description ?? 'GitHub sign-in did not complete.');
  };

  const handleSignIn = () => {
    setDeviceFlowLoading(true);
    setError(null);
    startGithubDeviceFlow()
      .then((code) => {
        activeDeviceCodeRef.current = code.device_code;
        window.open(code.verification_uri, '_blank', 'noopener,noreferrer');
        setDeviceFlow({
          userCode: code.user_code,
          deviceCode: code.device_code,
          verificationUri: code.verification_uri,
        });
        pollDeviceToken(code.device_code, code.interval);
      })
      .catch(() => setError('Could not reach GitHub.'))
      .finally(() => setDeviceFlowLoading(false));
  };

  const handleCancelDeviceFlow = () => {
    activeDeviceCodeRef.current = null;
    setDeviceFlow(null);
    setError(null);
  };

  if (connection) {
    return <ConnectedGithub connection={connection} onDisconnect={handleDisconnect} />;
  }

  if (deviceFlow) {
    return <DeviceFlowCard state={deviceFlow} error={error} onCancel={handleCancelDeviceFlow} />;
  }

  return (
    <Card size="small" texture="kraft" className="flex flex-1 flex-col gap-2 text-left">
      <p className="m-0 font-semibold">Connect GitHub</p>
      <p className="m-0 text-sm opacity-70">
        Sign in to browse and plan against your repositories.
      </p>
      <Button size="small" disabled={deviceFlowLoading} onClick={handleSignIn}>
        {deviceFlowLoading ? 'Starting…' : 'Sign in with GitHub'}
      </Button>
      <p className="m-0 text-sm opacity-70">
        Or mint a{' '}
        <a href={GITHUB_TOKEN_MINT_URL} target="_blank" rel="noopener noreferrer">
          fine-grained token
        </a>{' '}
        scoped to the repositories you want to browse and plan, then paste it in.
      </p>
      <Input
        size="small"
        type="password"
        label="Token"
        value={token}
        onChange={(e) => setToken(e.target.value)}
      />
      {error && <p className="m-0 text-watercolor-rose-dark text-sm">{error}</p>}
      <Button
        size="small"
        variant="secondary"
        disabled={token.trim() === '' || loading}
        onClick={handleConnect}
      >
        {loading ? 'Connecting…' : 'Connect'}
      </Button>
    </Card>
  );
};
