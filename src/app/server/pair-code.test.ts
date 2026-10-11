import { describe, expect, it } from 'vitest';
import { PAIR_CODE_TTL_MS, createPairCodeManager } from './pair-code';

describe('createPairCodeManager', () => {
  it('mints an 8-character Crockford base32 code valid for ten minutes', () => {
    const now = () => 1_000_000;
    const manager = createPairCodeManager(now);
    const { code, expiresAt } = manager.mint();
    expect(code).toMatch(/^[0-9A-HJKMNP-TV-Z]{8}$/);
    expect(expiresAt).toBe(now() + PAIR_CODE_TTL_MS);
  });

  it('redeems a pending code exactly once for the caller origin', () => {
    const manager = createPairCodeManager();
    const { code } = manager.mint();
    expect(manager.redeem(code, 'https://app.papercamp.dev')).toBe(true);
    expect(manager.redeem(code, 'https://other.example.com')).toBe(false);
  });

  it('is case- and dash-insensitive on redeem', () => {
    const manager = createPairCodeManager();
    const { code } = manager.mint();
    const grouped = `${code.slice(0, 4)}-${code.slice(4)}`.toLowerCase();
    expect(manager.redeem(grouped, 'https://app.papercamp.dev')).toBe(true);
  });

  it('rejects an unknown code', () => {
    const manager = createPairCodeManager();
    expect(manager.redeem('NOSUCHCO', 'https://app.papercamp.dev')).toBe(false);
  });

  it('expires a code after ten minutes', () => {
    let time = 0;
    const manager = createPairCodeManager(() => time);
    const { code } = manager.mint();
    time = PAIR_CODE_TTL_MS;
    expect(manager.redeem(code, 'https://app.papercamp.dev')).toBe(false);
  });

  it('cancels a code after five failed attempts land while it is outstanding', () => {
    const manager = createPairCodeManager();
    const { code } = manager.mint();
    for (let i = 0; i < 5; i++) {
      expect(manager.redeem('WRONGCOD', 'https://attacker.example.com')).toBe(false);
    }
    expect(manager.redeem(code, 'https://app.papercamp.dev')).toBe(false);
  });

  it('refuses more than twenty failed attempts a minute across all codes', () => {
    let time = 0;
    const manager = createPairCodeManager(() => time);
    for (let i = 0; i < 20; i++) {
      expect(manager.redeem('BADCODE1', 'https://app.papercamp.dev')).toBe(false);
    }
    const { code } = manager.mint();
    expect(manager.redeem(code, 'https://app.papercamp.dev')).toBe(false);
    time += 60_001;
    expect(manager.redeem(code, 'https://app.papercamp.dev')).toBe(true);
  });

  it('long-polls to pending then resolves once the code is redeemed', async () => {
    const manager = createPairCodeManager();
    const { code } = manager.mint();
    const outcome = manager.waitForOutcome(code);
    manager.redeem(code, 'https://app.papercamp.dev');
    expect(await outcome).toEqual({ status: 'paired', origin: 'https://app.papercamp.dev' });
  });

  it('resolves expired for an unknown code', async () => {
    const manager = createPairCodeManager();
    expect(await manager.waitForOutcome('NOSUCHCO')).toEqual({ status: 'expired' });
  });
});
