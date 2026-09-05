import { access, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { type DaemonState, removeDaemonState, writeDaemonState } from './daemon-state';

describe('writeDaemonState / removeDaemonState', () => {
  const dirs: string[] = [];

  afterAll(async () => {
    await Promise.all(dirs.map((dir) => rm(dir, { recursive: true, force: true })));
  });

  async function makeStatePath(): Promise<string> {
    const dir = await mkdtemp(join(tmpdir(), 'paper-camp-daemon-state-test-'));
    dirs.push(dir);
    return join(dir, 'daemon.json');
  }

  const sampleState: DaemonState = {
    pid: 1234,
    port: 4333,
    version: '0.27.0',
    startedAt: '2026-09-05T00:00:00.000Z',
    share: false,
    tailnet: true,
  };

  it('writes pid, port, version, startedAt and the share/tailnet flags to disk', async () => {
    const path = await makeStatePath();

    await writeDaemonState(path, sampleState);

    const written = JSON.parse(await readFile(path, 'utf-8'));
    expect(written).toEqual(sampleState);
  });

  it('creates the config dir if it does not exist yet', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'paper-camp-daemon-state-test-'));
    dirs.push(dir);
    const path = join(dir, 'nested', 'daemon.json');

    await writeDaemonState(path, sampleState);

    await expect(access(path)).resolves.toBeUndefined();
  });

  it('removes the state file', async () => {
    const path = await makeStatePath();
    await writeDaemonState(path, sampleState);

    await removeDaemonState(path);

    await expect(access(path)).rejects.toThrow();
  });

  it('is a no-op when the state file does not exist', async () => {
    const path = await makeStatePath();

    await expect(removeDaemonState(path)).resolves.toBeUndefined();
  });
});
