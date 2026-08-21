import type { ModuleLayer } from '@/app/services/module-layer';
import { useAppStore } from '@/app/stores/app-store';
import { Button, Card, Input } from '@dendelion/paper-ui';
import { useState } from 'react';

// The plan-only path onto the corpus (IDEA-193 phase 5): a fine-grained GitHub
// personal access token, minted by the user and kept device-local, never sent
// anywhere but api.github.com.
const GithubTokenForm = () => {
  const setGithubConfig = useAppStore((s) => s.setGithubConfig);
  const [owner, setOwner] = useState('');
  const [repo, setRepo] = useState('');
  const [token, setToken] = useState('');

  const canSave = owner.trim() !== '' && repo.trim() !== '' && token.trim() !== '';

  return (
    <Card size="small" texture="kraft" className="mt-4 w-full max-w-sm text-left">
      <p className="m-0 mb-3 text-sm opacity-[0.65]">
        No runtime reachable — paste a{' '}
        <a
          href="https://github.com/settings/personal-access-tokens/new"
          target="_blank"
          rel="noopener noreferrer"
        >
          fine-grained token
        </a>{' '}
        scoped to this repo to read and write the corpus directly.
      </p>
      <div className="flex flex-col gap-2">
        <Input
          size="small"
          label="Owner"
          value={owner}
          onChange={(e) => setOwner(e.target.value)}
        />
        <Input size="small" label="Repo" value={repo} onChange={(e) => setRepo(e.target.value)} />
        <Input
          size="small"
          type="password"
          label="Token"
          value={token}
          onChange={(e) => setToken(e.target.value)}
        />
      </div>
      <Button
        size="small"
        className="mt-3"
        disabled={!canSave}
        onClick={() =>
          setGithubConfig({ owner: owner.trim(), repo: repo.trim(), token: token.trim() })
        }
      >
        Save
      </Button>
    </Card>
  );
};

export const RuntimeUnavailable = ({ layer }: { layer?: ModuleLayer }) => (
  <div className="flex flex-1 flex-col items-center justify-center gap-2 py-24 text-center">
    <p className="font-handwritten text-lg">
      {layer === 'corpus' ? 'This needs the runtime or a GitHub token' : 'This needs the runtime'}
    </p>
    <p className="max-w-sm text-sm opacity-60">
      {layer === 'corpus'
        ? "Connect the project's runtime, or go plan-only below."
        : "Connect the project's runtime to use this — it owns the filesystem, git and the agent."}
    </p>
    {layer === 'corpus' && <GithubTokenForm />}
  </div>
);
