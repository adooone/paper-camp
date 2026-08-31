import { Button, Card, CopyButton, Input, ListItem } from '@dendelion/paper-ui';
import { useState } from 'react';
import { type DeviceFlowState, type GithubConnection, useGithubConnect } from '../hooks';

const GITHUB_TOKEN_MINT_URL = 'https://github.com/settings/personal-access-tokens/new';

interface TokenFallbackProps {
  token: string;
  onTokenChange: (token: string) => void;
  loading: boolean;
  onConnect: () => void;
}

const TokenFallback = ({ token, onTokenChange, loading, onConnect }: TokenFallbackProps) => (
  <>
    <p className="m-0 text-sm opacity-70">
      Mint a{' '}
      <a href={GITHUB_TOKEN_MINT_URL} target="_blank" rel="noopener noreferrer">
        fine-grained token
      </a>{' '}
      scoped to the repositories you want, then paste it in.
    </p>
    <Input
      size="small"
      type="password"
      label="Token"
      value={token}
      onChange={(e) => onTokenChange(e.target.value)}
    />
    <Button
      size="small"
      variant="secondary"
      disabled={token.trim() === '' || loading}
      onClick={onConnect}
    >
      {loading ? 'Connecting…' : 'Connect'}
    </Button>
  </>
);

interface DeviceFlowCardProps {
  state: DeviceFlowState;
  error: string | null;
  onCancel: () => void;
  token: string;
  onTokenChange: (token: string) => void;
  tokenLoading: boolean;
  onTokenConnect: () => void;
}

const DeviceFlowCard = ({
  state,
  error,
  onCancel,
  token,
  onTokenChange,
  tokenLoading,
  onTokenConnect,
}: DeviceFlowCardProps) => {
  const [tokenFallbackOpen, setTokenFallbackOpen] = useState(false);

  return (
    <Card size="small" texture="kraft" className="flex flex-1 flex-col gap-2 text-left">
      <p className="m-0 font-semibold">Sign in with GitHub</p>
      <p className="m-0 text-sm opacity-70">Enter this code on the GitHub tab that just opened:</p>
      <p className="m-0 flex items-center gap-2 text-lg font-semibold tracking-widest">
        {state.userCode}
        <CopyButton text={state.userCode} />
      </p>
      {error && <p className="m-0 text-watercolor-rose-dark text-sm">{error}</p>}
      <div className="flex gap-2">
        <Button size="small" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        {!tokenFallbackOpen && (
          <Button size="small" variant="ghost" onClick={() => setTokenFallbackOpen(true)}>
            Paste a token instead
          </Button>
        )}
      </div>
      {tokenFallbackOpen && (
        <TokenFallback
          token={token}
          onTokenChange={onTokenChange}
          loading={tokenLoading}
          onConnect={onTokenConnect}
        />
      )}
    </Card>
  );
};

interface RepoLabelProps {
  repoName: string;
}

function RepoLabel({ repoName }: RepoLabelProps) {
  const slash = repoName.indexOf('/');
  if (slash === -1) {
    return (
      <span className="block truncate" title={repoName}>
        {repoName}
      </span>
    );
  }
  return (
    <span className="flex min-w-0 items-center" title={repoName}>
      <span className="min-w-0 truncate">{repoName.slice(0, slash)}</span>
      <span className="shrink-0">{repoName.slice(slash)}</span>
    </span>
  );
}

interface ConnectedGithubProps {
  connection: GithubConnection;
  chosenRepoNames: string[];
  onDisconnect: () => void;
  onAddRepo: (repoFullName: string) => void;
}

const ConnectedGithub = ({
  connection,
  chosenRepoNames,
  onDisconnect,
  onAddRepo,
}: ConnectedGithubProps) => {
  const [query, setQuery] = useState('');

  const chosenSet = new Set(chosenRepoNames);
  const trimmedQuery = query.trim().toLowerCase();
  const pickable = connection.repoNames.filter(
    (repoName) => !chosenSet.has(repoName) && repoName.toLowerCase().includes(trimmedQuery),
  );

  return (
    <Card size="small" texture="kraft" className="flex flex-1 flex-col gap-2 text-left">
      <div className="flex items-center justify-between gap-2">
        <p
          className="m-0 min-w-0 truncate font-semibold"
          title={`Connected as ${connection.identity.login}`}
        >
          Connected as {connection.identity.login}
        </p>
        <Button size="small" variant="secondary" className="shrink-0" onClick={onDisconnect}>
          Disconnect
        </Button>
      </div>
      <Input
        type="search"
        size="small"
        placeholder="Search repositories…"
        aria-label="Search repositories"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="flex max-h-[160px] flex-col gap-1 overflow-y-auto">
        {pickable.length === 0 ? (
          <p className="m-0 text-sm opacity-70">
            {connection.repoNames.length === 0
              ? 'This token reaches no repositories yet.'
              : 'No matching repositories.'}
          </p>
        ) : (
          pickable.map((repoName) => (
            <ListItem
              key={repoName}
              size="small"
              className="min-w-0"
              onClick={() => onAddRepo(repoName)}
            >
              <RepoLabel repoName={repoName} />
            </ListItem>
          ))
        )}
      </div>
    </Card>
  );
};

export interface GithubConnectCardProps {
  chosenRepoNames: string[];
  onAddRepo: (repoFullName: string) => void;
}

export const GithubConnectCard = ({ chosenRepoNames, onAddRepo }: GithubConnectCardProps) => {
  const {
    connection,
    loading,
    error,
    deviceFlow,
    deviceFlowLoading,
    token,
    setToken,
    connectWithToken,
    disconnect,
    signIn,
    cancelDeviceFlow,
  } = useGithubConnect();

  if (connection) {
    return (
      <ConnectedGithub
        connection={connection}
        chosenRepoNames={chosenRepoNames}
        onDisconnect={disconnect}
        onAddRepo={onAddRepo}
      />
    );
  }

  if (deviceFlow) {
    return (
      <DeviceFlowCard
        state={deviceFlow}
        error={error}
        onCancel={cancelDeviceFlow}
        token={token}
        onTokenChange={setToken}
        tokenLoading={loading}
        onTokenConnect={connectWithToken}
      />
    );
  }

  return (
    <Card size="small" texture="kraft" className="flex flex-1 flex-col gap-2 text-left">
      <p className="m-0 font-semibold">Connect GitHub</p>
      <p className="m-0 text-sm opacity-70">
        Sign in to browse and plan against your repositories.
      </p>
      <Button size="small" disabled={deviceFlowLoading} onClick={signIn}>
        {deviceFlowLoading ? 'Starting…' : 'Sign in with GitHub'}
      </Button>
      {error && <p className="m-0 text-watercolor-rose-dark text-sm">{error}</p>}
    </Card>
  );
};
