import { spawn } from 'node:child_process';
import type { AgentId, CapabilityResult } from '../../types';
import { AGENTS } from './agents';

interface ProbeResult {
  code: number | null;
  stdout: string;
  stderr: string;
}

function run(command: string, args: string[], cwd: string): Promise<ProbeResult> {
  return new Promise((resolve) => {
    const proc = spawn(command, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    proc.stdout?.on('data', (d: Buffer) => {
      stdout += d.toString();
    });
    proc.stderr?.on('data', (d: Buffer) => {
      stderr += d.toString();
    });
    proc.on('close', (code) => resolve({ code, stdout, stderr }));
    // Missing binary: spawn emits 'error' instead of 'close'.
    proc.on('error', () => resolve({ code: null, stdout: '', stderr: '' }));
  });
}

async function probeGit(root: string): Promise<CapabilityResult> {
  const repo = await run('git', ['rev-parse', '--is-inside-work-tree'], root);
  if (repo.code !== 0) {
    return { id: 'git', status: 'missing', detail: 'Not inside a git repository' };
  }
  const [name, email] = await Promise.all([
    run('git', ['config', 'user.name'], root),
    run('git', ['config', 'user.email'], root),
  ]);
  if (!name.stdout.trim() || !email.stdout.trim()) {
    return {
      id: 'git',
      status: 'warn',
      detail: 'Repository found, but user.name/user.email is not set',
    };
  }
  return { id: 'git', status: 'ok', detail: `${name.stdout.trim()} <${email.stdout.trim()}>` };
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

async function probeAgent(id: AgentId, root: string): Promise<CapabilityResult> {
  const { command } = AGENTS[id];
  const result = await run(command, ['--version'], root);
  if (result.code !== 0) {
    return { id: `agent:${id}`, status: 'missing', detail: `${command} not found on PATH` };
  }
  const version = (result.stdout || result.stderr).trim().split('\n')[0];
  return { id: `agent:${id}`, status: 'ok', detail: version || command };
}

export async function probeCapabilities(root: string): Promise<CapabilityResult[]> {
  const agentIds = Object.keys(AGENTS) as AgentId[];
  const [git, gh, ...agents] = await Promise.all([
    probeGit(root),
    probeGh(root),
    ...agentIds.map((id) => probeAgent(id, root)),
  ]);
  return [git, gh, ...agents];
}
