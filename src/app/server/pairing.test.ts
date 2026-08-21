import { describe, expect, it } from 'vitest';
import { createPairingManager } from './pairing';

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
