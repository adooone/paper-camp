import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { readTailnetStatus } from './tailnet';

describe('readTailnetStatus', () => {
  const dirs: string[] = [];
  const originalPath = process.env.PATH;

  afterEach(async () => {
    process.env.PATH = originalPath;
    await Promise.all(dirs.map((dir) => rm(dir, { recursive: true, force: true })));
    dirs.length = 0;
  });

  async function stubTailscale(script: string): Promise<void> {
    const dir = await mkdtemp(join(tmpdir(), 'paper-camp-tailscale-'));
    dirs.push(dir);
    const binPath = join(dir, 'tailscale');
    await writeFile(binPath, `#!/bin/sh\n${script}\n`, { mode: 0o755 });
    process.env.PATH = `${dir}:${originalPath}`;
  }

  const runningStatus = {
    BackendState: 'Running',
    Self: { DNSName: 'deimos.pitta-ray.ts.net.' },
    MagicDNSSuffix: 'pitta-ray.ts.net',
    Peer: {
      a: { DNSName: 'online-peer.pitta-ray.ts.net.', Online: true },
      b: { DNSName: 'offline-peer.pitta-ray.ts.net.', Online: false },
      c: { Online: true },
    },
  };

  it('returns undefined when the tailscale binary is missing', async () => {
    process.env.PATH = '';
    expect(await readTailnetStatus()).toBeUndefined();
  });

  it('returns undefined when tailscale exits non-zero', async () => {
    await stubTailscale('exit 1');
    expect(await readTailnetStatus()).toBeUndefined();
  });

  it('returns undefined when the output is not valid JSON', async () => {
    await stubTailscale('echo "not json"');
    expect(await readTailnetStatus()).toBeUndefined();
  });

  it('returns undefined when the backend is not running', async () => {
    await stubTailscale(`echo '${JSON.stringify({ ...runningStatus, BackendState: 'Stopped' })}'`);
    expect(await readTailnetStatus()).toBeUndefined();
  });

  it('returns undefined when Self.DNSName is absent', async () => {
    await stubTailscale(`echo '${JSON.stringify({ ...runningStatus, Self: {} })}'`);
    expect(await readTailnetStatus()).toBeUndefined();
  });

  it('returns undefined when MagicDNSSuffix is absent', async () => {
    await stubTailscale(
      `echo '${JSON.stringify({ ...runningStatus, MagicDNSSuffix: undefined })}'`,
    );
    expect(await readTailnetStatus()).toBeUndefined();
  });

  it('reads the self identity and online peers, stripping trailing dots', async () => {
    await stubTailscale(`echo '${JSON.stringify(runningStatus)}'`);
    expect(await readTailnetStatus()).toEqual({
      selfDnsName: 'deimos.pitta-ray.ts.net',
      magicDnsSuffix: 'pitta-ray.ts.net',
      onlinePeers: [{ dnsName: 'online-peer.pitta-ray.ts.net' }],
    });
  });
});
