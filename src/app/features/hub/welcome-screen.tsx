import { runtimeAdditionUrl } from '@/app/services/hub';
import { Button, Card, Input } from '@dendelion/paper-ui';
import { useState } from 'react';

const GITHUB_TOKEN_MINT_URL = 'https://github.com/settings/personal-access-tokens/new';

const ConnectGithubCard = () => (
  <Card size="small" texture="kraft" className="flex flex-1 flex-col gap-2 text-left">
    <p className="m-0 font-semibold">Connect GitHub</p>
    <p className="m-0 text-sm opacity-70">
      Mint a fine-grained token to browse and plan a project with no runtime up.
    </p>
    <Button size="small" onClick={() => window.open(GITHUB_TOKEN_MINT_URL, '_blank', 'noopener')}>
      Get a token on GitHub
    </Button>
  </Card>
);

const AddByRuntimeUrlCard = () => {
  const [runtimeUrl, setRuntimeUrl] = useState('');
  const trimmedUrl = runtimeUrl.trim();

  return (
    <Card size="small" texture="kraft" className="flex flex-1 flex-col gap-2 text-left">
      <p className="m-0 font-semibold">Add a project by URL</p>
      <p className="m-0 text-sm opacity-70">
        Paste the address <code>paper-camp dev</code> printed when it started.
      </p>
      <Input
        size="small"
        label="Runtime URL"
        placeholder="http://localhost:3333"
        value={runtimeUrl}
        onChange={(e) => setRuntimeUrl(e.target.value)}
      />
      <Button
        size="small"
        disabled={trimmedUrl === ''}
        onClick={() =>
          window.location.assign(runtimeAdditionUrl(window.location.pathname, trimmedUrl))
        }
      >
        Connect
      </Button>
    </Card>
  );
};

export const WelcomeScreen = () => (
  <div className="flex flex-col gap-6">
    <p className="m-0 text-center text-sm opacity-70">
      Nothing is open yet — connect GitHub, or add a project by its runtime URL.
    </p>
    <div className="flex flex-col gap-4 sm:flex-row">
      <ConnectGithubCard />
      <AddByRuntimeUrlCard />
    </div>
  </div>
);
