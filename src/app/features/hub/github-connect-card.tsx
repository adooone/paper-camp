import { GithubApiError } from '@/app/services/github/client';
import {
  clearHubGithubToken,
  readHubGithubToken,
  writeHubGithubToken,
} from '@/app/services/github/hub-token-store';
import { fetchAccessibleRepoNames, fetchGithubIdentity } from '@/app/services/github/identity';
import type { GithubIdentity } from '@/app/services/github/identity';
import { Button, Card, Input, ListItem } from '@dendelion/paper-ui';
import { useEffect, useState } from 'react';

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

const ConnectedGithub = ({
  connection,
  onDisconnect,
}: {
  connection: Connection;
  onDisconnect: () => void;
}) => (
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

  if (connection) {
    return <ConnectedGithub connection={connection} onDisconnect={handleDisconnect} />;
  }

  return (
    <Card size="small" texture="kraft" className="flex flex-1 flex-col gap-2 text-left">
      <p className="m-0 font-semibold">Connect GitHub</p>
      <p className="m-0 text-sm opacity-70">
        Mint a{' '}
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
      <Button size="small" disabled={token.trim() === '' || loading} onClick={handleConnect}>
        {loading ? 'Connecting…' : 'Connect'}
      </Button>
    </Card>
  );
};
