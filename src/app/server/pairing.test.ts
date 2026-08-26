import { mkdirSync, mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createPairingManager, loadPairingState, savePairingState } from './pairing';

describe('createPairingManager', () => {
  it('issues a fresh token when no prior state is given', () => {
    const a = createPairingManager();
    const b = createPairingManager();
    expect(a.token).toMatch(/^[0-9a-f]{64}$/);
    expect(a.token).not.toBe(b.token);
  });

  it('pairs an origin when the token matches, and remembers it', () => {
    const pairing = createPairingManager();
    expect(pairing.isPairedOrigin('https://app.papercamp.dev')).toBe(false);
    expect(pairing.pair(pairing.token, 'https://app.papercamp.dev')).toBe(true);
    expect(pairing.isPairedOrigin('https://app.papercamp.dev')).toBe(true);
  });

  it('refuses to pair on a wrong token', () => {
    const pairing = createPairingManager();
    expect(pairing.pair('wrong-token', 'https://app.papercamp.dev')).toBe(false);
    expect(pairing.isPairedOrigin('https://app.papercamp.dev')).toBe(false);
  });

  it('restores prior token and origins from state', () => {
    const first = createPairingManager();
    first.pair(first.token, 'https://app.papercamp.dev');
    const second = createPairingManager(first.getState());
    expect(second.token).toBe(first.token);
    expect(second.isPairedOrigin('https://app.papercamp.dev')).toBe(true);
  });
});

describe('loadPairingState / savePairingState', () => {
  function tempRoot(): string {
    return mkdtempSync(join(tmpdir(), 'papercamp-pairing-test-'));
  }

  it('resolves undefined when no file exists yet', async () => {
    expect(await loadPairingState(tempRoot())).toBeUndefined();
  });

  it('resolves undefined for a malformed file', async () => {
    const root = tempRoot();
    mkdirSync(join(root, 'papercamp'), { recursive: true });
    writeFileSync(join(root, 'papercamp', '.pairing.json'), 'not json');
    expect(await loadPairingState(root)).toBeUndefined();
  });

  it('round-trips a token and origins, written with mode 0600', async () => {
    const root = tempRoot();
    const state = { token: 'abc123', origins: new Set(['https://app.papercamp.dev']) };
    await savePairingState(root, state);

    const path = join(root, 'papercamp', '.pairing.json');
    expect(JSON.parse(readFileSync(path, 'utf-8'))).toEqual({
      token: 'abc123',
      origins: ['https://app.papercamp.dev'],
    });
    expect(statSync(path).mode & 0o777).toBe(0o600);

    const loaded = await loadPairingState(root);
    expect(loaded).toEqual(state);
  });
});
