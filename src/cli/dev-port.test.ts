import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { readConfigIntegration, readConfigPort, resolveDevPort } from './dev-port';

describe('resolveDevPort', () => {
  it('prefers an explicit port over config', () => {
    expect(resolveDevPort('4000', 3041)).toBe(4000);
  });

  it('falls back to config.port when no explicit port', () => {
    expect(resolveDevPort(undefined, 3041)).toBe(3041);
  });

  it('falls back to 3333 when neither is set', () => {
    expect(resolveDevPort(undefined, undefined)).toBe(3333);
  });
});

describe('readConfigPort', () => {
  const dirs: string[] = [];

  afterAll(async () => {
    await Promise.all(dirs.map((dir) => rm(dir, { recursive: true, force: true })));
  });

  async function makeRoot(config: unknown): Promise<string> {
    const root = await mkdtemp(join(tmpdir(), 'paper-camp-dev-port-'));
    dirs.push(root);
    await mkdir(join(root, 'papercamp'), { recursive: true });
    if (config !== undefined) {
      await writeFile(join(root, 'papercamp', 'config.json'), JSON.stringify(config));
    }
    return root;
  }

  it('reads a numeric port from config.json', async () => {
    const root = await makeRoot({ port: 3041 });
    expect(await readConfigPort(root)).toBe(3041);
  });

  it('returns undefined when config.json is missing', async () => {
    const root = await makeRoot(undefined);
    expect(await readConfigPort(root)).toBeUndefined();
  });

  it('returns undefined when port is not a number', async () => {
    const root = await makeRoot({ port: '3041' });
    expect(await readConfigPort(root)).toBeUndefined();
  });

  it('returns undefined when config.json is invalid JSON', async () => {
    const root = await makeRoot(undefined);
    await writeFile(join(root, 'papercamp', 'config.json'), '{not json');
    expect(await readConfigPort(root)).toBeUndefined();
  });
});

describe('readConfigIntegration', () => {
  const dirs: string[] = [];

  afterAll(async () => {
    await Promise.all(dirs.map((dir) => rm(dir, { recursive: true, force: true })));
  });

  async function makeRoot(config: unknown): Promise<string> {
    const root = await mkdtemp(join(tmpdir(), 'paper-camp-dev-integration-'));
    dirs.push(root);
    await mkdir(join(root, 'papercamp'), { recursive: true });
    if (config !== undefined) {
      await writeFile(join(root, 'papercamp', 'config.json'), JSON.stringify(config));
    }
    return root;
  }

  it('reads toolbar.enabled from config.json', async () => {
    const root = await makeRoot({ integration: { toolbar: { enabled: false } } });
    expect(await readConfigIntegration(root)).toEqual({ enabled: false });
  });

  it('returns undefined when no integration block is present', async () => {
    const root = await makeRoot({ port: 3041 });
    expect(await readConfigIntegration(root)).toBeUndefined();
  });

  it('returns undefined when config.json is missing', async () => {
    const root = await makeRoot(undefined);
    expect(await readConfigIntegration(root)).toBeUndefined();
  });
});
