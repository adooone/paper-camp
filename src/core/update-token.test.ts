import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadOrMintUpdateToken } from './update-token';

function tempPath(): string {
  return join(mkdtempSync(join(tmpdir(), 'papercamp-update-token-test-')), 'update-token');
}

describe('loadOrMintUpdateToken', () => {
  it('mints a fresh token on a first-ever boot, written with mode 0600', async () => {
    const path = tempPath();
    const token = await loadOrMintUpdateToken(path);
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    expect(readFileSync(path, 'utf-8').trim()).toBe(token);
    expect(statSync(path).mode & 0o777).toBe(0o600);
  });

  it('a restart reloads the persisted token unchanged', async () => {
    const path = tempPath();
    const first = await loadOrMintUpdateToken(path);
    const second = await loadOrMintUpdateToken(path);
    expect(second).toBe(first);
  });

  it('revocation: deleting the file mints a new token', async () => {
    const path = tempPath();
    const first = await loadOrMintUpdateToken(path);
    rmSync(path);
    const second = await loadOrMintUpdateToken(path);
    expect(second).not.toBe(first);
  });
});
