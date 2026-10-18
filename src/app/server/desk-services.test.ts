import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDeskServiceManager } from './desk-services';

let lastPid = 1000;

class FakePty {
  pid = ++lastPid;
  killSignals: (string | undefined)[] = [];
  private dataListeners: ((chunk: string) => void)[] = [];
  private exitListeners: ((event: { exitCode: number }) => void)[] = [];

  onData(listener: (chunk: string) => void) {
    this.dataListeners.push(listener);
    return { dispose: () => {} };
  }

  onExit(listener: (event: { exitCode: number }) => void) {
    this.exitListeners.push(listener);
    return { dispose: () => {} };
  }

  kill(signal?: string) {
    this.killSignals.push(signal);
  }

  emitData(chunk: string) {
    for (const listener of [...this.dataListeners]) listener(chunk);
  }

  emitExit(exitCode: number) {
    for (const listener of [...this.exitListeners]) listener({ exitCode });
  }
}

const ptys: FakePty[] = [];

vi.mock('node-pty', () => ({
  spawn: () => {
    const proc = new FakePty();
    ptys.push(proc);
    return proc;
  },
}));

const roots: string[] = [];

function makeManager() {
  const root = mkdtempSync(join(tmpdir(), 'papercamp-desk-services-'));
  mkdirSync(join(root, 'papercamp'));
  writeFileSync(
    join(root, 'papercamp', 'config.json'),
    JSON.stringify({ desk: { services: [{ name: 'app', cmd: 'noop' }] } }),
  );
  roots.push(root);
  return createDeskServiceManager(root);
}

async function stateOf(manager: ReturnType<typeof createDeskServiceManager>) {
  const [state] = await manager.getStatus();
  return state;
}

afterEach(async () => {
  ptys.length = 0;
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('createDeskServiceManager', () => {
  it('start spawns the command and opens the log with the started marker', async () => {
    const manager = makeManager();
    await manager.start('app');
    expect(ptys).toHaveLength(1);
    expect((await stateOf(manager)).status).toBe('running');
    ptys[0].emitData('ready\n');
    const lines = manager.getLog('app') ?? [];
    expect(lines[0]).toMatch(/^── started \d{2}:\d{2} ──$/);
    expect(lines[1]).toBe('ready');
  });

  it('rejects a name missing from the manifest', async () => {
    const manager = makeManager();
    await expect(manager.start('ghost')).rejects.toThrow(/ghost/);
  });

  it('a crash keeps the log and records the exit code', async () => {
    const manager = makeManager();
    await manager.start('app');
    ptys[0].emitData('boom\n');
    ptys[0].emitExit(1);
    const state = await stateOf(manager);
    expect(state.status).toBe('crashed');
    expect(state.exitCode).toBe(1);
    expect(state.pid).toBeNull();
    expect(manager.getLog('app')).toContain('boom');
  });

  it('stop kills the process and a clean exit lands on stopped', async () => {
    const manager = makeManager();
    await manager.start('app');
    manager.stop('app');
    expect((await stateOf(manager)).status).toBe('stopping');
    expect(ptys[0].killSignals).toHaveLength(1);
    ptys[0].emitExit(0);
    expect((await stateOf(manager)).status).toBe('stopped');
  });

  it('restart waits for the old process to exit before spawning anew', async () => {
    const manager = makeManager();
    await manager.start('app');
    ptys[0].emitData('old line\n');
    const restarting = manager.restart('app');
    expect(ptys).toHaveLength(1);
    ptys[0].emitExit(0);
    await restarting;
    expect(ptys).toHaveLength(2);
    expect((await stateOf(manager)).status).toBe('running');
    const lines = manager.getLog('app') ?? [];
    expect(lines).toContain('old line');
    expect(lines.filter((line) => line.startsWith('── started'))).toHaveLength(2);
  });

  it('restart of a crashed service just starts it', async () => {
    const manager = makeManager();
    await manager.start('app');
    ptys[0].emitExit(1);
    await manager.restart('app');
    expect(ptys).toHaveLength(2);
    expect((await stateOf(manager)).status).toBe('running');
  });

  it('starting after a crash keeps the crash output between the two markers', async () => {
    const manager = makeManager();
    await manager.start('app');
    ptys[0].emitData('crash output\n');
    ptys[0].emitExit(1);
    await manager.start('app');
    const lines = manager.getLog('app') ?? [];
    const markers = lines.flatMap((line, i) => (line.startsWith('── started') ? [i] : []));
    expect(markers).toHaveLength(2);
    const crashAt = lines.indexOf('crash output');
    expect(crashAt).toBeGreaterThan(markers[0]);
    expect(crashAt).toBeLessThan(markers[1]);
  });

  it('the log keeps only the last 500 lines', async () => {
    const manager = makeManager();
    await manager.start('app');
    const chunk = Array.from({ length: 600 }, (_, i) => `line ${i}`).join('\n');
    ptys[0].emitData(`${chunk}\n`);
    const lines = manager.getLog('app') ?? [];
    expect(lines).toHaveLength(500);
    expect(lines[0]).toBe('line 100');
    expect(lines.at(-1)).toBe('line 599');
  });
});
