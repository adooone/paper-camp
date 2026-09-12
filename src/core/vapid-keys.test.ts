import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { loadOrMintVapidKeys } from './vapid-keys';

const dirs: string[] = [];

afterAll(async () => {
  await Promise.all(dirs.map((dir) => rm(dir, { recursive: true, force: true })));
});

async function makeTempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'paper-camp-vapid-'));
  dirs.push(dir);
  return dir;
}

describe('loadOrMintVapidKeys', () => {
  it('mints a base64url key pair on first call', async () => {
    const dir = await makeTempDir();
    const keys = await loadOrMintVapidKeys(join(dir, 'vapid.json'));
    expect(keys.publicKey).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(keys.privateKey).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('returns the same keys on a second call', async () => {
    const dir = await makeTempDir();
    const path = join(dir, 'vapid.json');
    const first = await loadOrMintVapidKeys(path);
    const second = await loadOrMintVapidKeys(path);
    expect(second).toEqual(first);
  });

  it('resolves malformed JSON to a freshly minted pair', async () => {
    const dir = await makeTempDir();
    const path = join(dir, 'vapid.json');
    await writeFile(path, 'not json', 'utf-8');
    const keys = await loadOrMintVapidKeys(path);
    expect(keys.publicKey).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});
