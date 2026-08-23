import type { CapabilityResult, ConnectAction } from '../../types';
import { run } from './run';

// The runtime speaks to these on the user's behalf (GitHub today, Figma/Linear later);
// credentials live in each service's own CLI, tied to a remote account, not Paper Camp.
export interface ExternalServiceDefinition {
  id: string;
  label: string;
  unlocks: string;
  probe: (root: string) => Promise<CapabilityResult>;
  /** Null once the service probes `ok` — nothing to connect. */
  connect: (result: CapabilityResult) => ConnectAction | null;
  authenticated: (root: string) => Promise<boolean | null>;
}

async function probeGh(root: string): Promise<CapabilityResult> {
  const version = await run('gh', ['--version'], root);
  if (version.code !== 0) {
    return { id: 'gh', status: 'missing', detail: 'gh CLI not found on PATH' };
  }
  const auth = await run('gh', ['auth', 'status'], root);
  if (auth.code !== 0) {
    return { id: 'gh', status: 'warn', detail: 'gh is installed but not authenticated' };
  }
  const origin = await run('git', ['remote', 'get-url', 'origin'], root);
  if (origin.code !== 0) {
    return {
      id: 'gh',
      status: 'warn',
      detail: 'Authenticated, but repository has no origin remote',
    };
  }
  const repoView = await run('gh', ['repo', 'view', '--json', 'nameWithOwner'], root);
  if (repoView.code !== 0) {
    return {
      id: 'gh',
      status: 'warn',
      detail: 'Authenticated, but origin is not reachable on GitHub',
    };
  }
  return { id: 'gh', status: 'ok', detail: origin.stdout.trim() };
}

function ghConnect(result: CapabilityResult): ConnectAction | null {
  if (result.status === 'missing') {
    return { kind: 'link', url: 'https://cli.github.com', label: 'Install the GitHub CLI' };
  }
  if (result.status === 'warn') {
    if (result.detail.includes('no origin remote')) {
      return { kind: 'command', command: 'git remote add origin <url>' };
    }
    if (result.detail.includes('not reachable')) {
      return { kind: 'command', command: 'gh repo view' };
    }
    return { kind: 'command', command: 'gh auth login' };
  }
  return null;
}

async function ghAuthenticated(root: string): Promise<boolean | null> {
  const version = await run('gh', ['--version'], root);
  if (version.code !== 0) return null;
  const auth = await run('gh', ['auth', 'status'], root);
  return auth.code === 0;
}

export const EXTERNAL_SERVICES: ExternalServiceDefinition[] = [
  {
    id: 'gh',
    label: 'GitHub CLI',
    unlocks: 'PR badges, review flow, fix-review',
    probe: probeGh,
    connect: ghConnect,
    authenticated: ghAuthenticated,
  },
];
