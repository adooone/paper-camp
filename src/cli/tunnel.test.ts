import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  extractTunnelUrl,
  isCloudflaredAvailable,
  quickTunnelArgs,
  startQuickTunnel,
} from './tunnel';

describe('extractTunnelUrl', () => {
  it('finds the https trycloudflare address inside cloudflared banner output', () => {
    const output = [
      '+--------------------------------------------------------------------------------------------+',
      '|  Your quick Tunnel has been created! Visit it at (it may take some time to be reachable):  |',
      '|  https://random-words-here.trycloudflare.com                                               |',
      '+--------------------------------------------------------------------------------------------+',
    ].join('\n');
    expect(extractTunnelUrl(output)).toBe('https://random-words-here.trycloudflare.com');
  });

  it('returns null when no tunnel address is present', () => {
    expect(extractTunnelUrl('2024-01-01T00:00:00Z INF Starting tunnel')).toBeNull();
  });
});

describe('quickTunnelArgs', () => {
  // A machine already running a named tunnel otherwise has its /etc config picked up,
  // and the quick address serves that tunnel's ingress instead of the dev server.
  it('points cloudflared at an isolated config so it cannot join an existing tunnel', () => {
    expect(quickTunnelArgs(3333, '/tmp/empty.yml')).toEqual([
      '--config',
      '/tmp/empty.yml',
      'tunnel',
      '--url',
      'http://localhost:3333',
    ]);
  });

  it('passes --config before the subcommand, where cloudflared accepts global flags', () => {
    const args = quickTunnelArgs(4800, '/tmp/empty.yml');
    expect(args.indexOf('--config')).toBeLessThan(args.indexOf('tunnel'));
  });
});

describe('cloudflared binary stubbing', () => {
  const dirs: string[] = [];
  const originalPath = process.env.PATH;

  afterEach(async () => {
    process.env.PATH = originalPath;
    await Promise.all(dirs.map((dir) => rm(dir, { recursive: true, force: true })));
    dirs.length = 0;
  });

  async function stubCloudflared(script: string): Promise<string> {
    const dir = await mkdtemp(join(tmpdir(), 'paper-camp-cloudflared-'));
    dirs.push(dir);
    const binPath = join(dir, 'cloudflared');
    await writeFile(binPath, `#!/bin/sh\n${script}\n`, { mode: 0o755 });
    process.env.PATH = `${dir}:${originalPath}`;
    return binPath;
  }

  describe('startQuickTunnel', () => {
    it('resolves with the tunnel url once cloudflared prints one', async () => {
      await stubCloudflared('echo "|  https://foo-bar.trycloudflare.com  |" >&2\nsleep 5 &\nwait');
      const tunnel = await startQuickTunnel(3333);
      expect(tunnel.url).toBe('https://foo-bar.trycloudflare.com');
      tunnel.process.kill();
    });

    it('rejects when cloudflared exits before printing a url', async () => {
      await stubCloudflared('echo "boom" >&2\nexit 1');
      await expect(startQuickTunnel(3333)).rejects.toThrow(/exited before printing/);
    });

    it('rejects when the cloudflared binary is missing', async () => {
      process.env.PATH = '';
      await expect(startQuickTunnel(3333)).rejects.toThrow();
    });
  });

  describe('isCloudflaredAvailable', () => {
    it('resolves true when cloudflared exits 0 for --version', async () => {
      await stubCloudflared('exit 0');
      expect(await isCloudflaredAvailable()).toBe(true);
    });

    it('resolves false when cloudflared exits non-zero', async () => {
      await stubCloudflared('exit 1');
      expect(await isCloudflaredAvailable()).toBe(false);
    });

    it('resolves false when the binary is missing', async () => {
      process.env.PATH = '';
      expect(await isCloudflaredAvailable()).toBe(false);
    });
  });
});
