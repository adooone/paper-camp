import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildMachineLink,
  hostLabel,
  loadMachineConnection,
  pairMachine,
  parsePairCode,
  readMachineConnection,
  readPairCodeFromHash,
} from './machine-connection';
import { listMachines, machineToken } from './machine-store';

class FakeLocalStorage {
  private store = new Map<string, string>();
  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
}

describe('readMachineConnection', () => {
  it('is empty when the visit carries no machine link', () => {
    expect(readMachineConnection({ search: '' })).toEqual({ machineUrl: '', pairingToken: null });
  });

  it('is empty when there is no location at all', () => {
    expect(readMachineConnection(null)).toEqual({ machineUrl: '', pairingToken: null });
  });

  it('reads a machine URL with no pairing token', () => {
    expect(readMachineConnection({ search: '?machine=http%3A%2F%2Flocalhost%3A4333' })).toEqual({
      machineUrl: 'http://localhost:4333',
      pairingToken: null,
    });
  });

  it('reads a machine URL alongside its pairing token', () => {
    expect(
      readMachineConnection({
        search: '?machine=http%3A%2F%2Flocalhost%3A4333&token=abc123',
      }),
    ).toEqual({ machineUrl: 'http://localhost:4333', pairingToken: 'abc123' });
  });
});

describe('loadMachineConnection', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', new FakeLocalStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('remembers the machine carried in the query string', () => {
    const connection = loadMachineConnection({
      search: '?machine=http%3A%2F%2Flocalhost%3A4333&token=abc123',
    });
    expect(connection).toEqual({ machineUrl: 'http://localhost:4333', pairingToken: 'abc123' });
    expect(listMachines()).toEqual(['http://localhost:4333']);
  });

  it('remembers nothing with no query string', () => {
    expect(loadMachineConnection({ search: '' })).toEqual({
      machineUrl: '',
      pairingToken: null,
    });
    expect(listMachines()).toEqual([]);
  });
});

describe('parsePairCode', () => {
  it('splits the code from the tailnet host', () => {
    expect(parsePairCode('7KQ4-M9XZ@deimos.pitta-ray.ts.net')).toEqual({
      code: '7KQ4-M9XZ',
      host: 'deimos.pitta-ray.ts.net',
      machineUrl: 'https://deimos.pitta-ray.ts.net',
    });
  });

  it('trims surrounding whitespace from a pasted code', () => {
    expect(parsePairCode('  7KQ4-M9XZ@deimos.pitta-ray.ts.net  ')?.host).toBe(
      'deimos.pitta-ray.ts.net',
    );
  });

  it('rejects text with no @ or nothing on either side of it', () => {
    expect(parsePairCode('not a code')).toBeNull();
    expect(parsePairCode('@deimos.pitta-ray.ts.net')).toBeNull();
    expect(parsePairCode('7KQ4-M9XZ@')).toBeNull();
  });
});

describe('hostLabel', () => {
  it('is the first label of a tailnet hostname', () => {
    expect(hostLabel('deimos.pitta-ray.ts.net')).toBe('deimos');
  });
});

describe('readPairCodeFromHash', () => {
  it('reads a code out of the #pair= fragment', () => {
    expect(readPairCodeFromHash('#pair=7KQ4-M9XZ%40deimos.pitta-ray.ts.net')).toEqual({
      code: '7KQ4-M9XZ',
      host: 'deimos.pitta-ray.ts.net',
      machineUrl: 'https://deimos.pitta-ray.ts.net',
    });
  });

  it('is null with no #pair= fragment at all', () => {
    expect(readPairCodeFromHash('')).toBeNull();
    expect(readPairCodeFromHash('#other=1')).toBeNull();
  });
});

describe('pairMachine', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', new FakeLocalStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('stores the token it gets back, exactly as a link pairing does', async () => {
    const probeMachine = vi.fn().mockResolvedValue({ projects: [], pendingUpdateVersion: null });
    const redeemCode = vi.fn().mockResolvedValue({ token: 'abc', origin: 'https://preview.test' });

    const outcome = await pairMachine(
      'https://deimos.pitta-ray.ts.net',
      '7KQ4-M9XZ',
      probeMachine,
      redeemCode,
    );

    expect(outcome).toEqual({
      ok: true,
      machineUrl: 'https://deimos.pitta-ray.ts.net',
      pairingToken: 'abc',
    });
    expect(machineToken('https://deimos.pitta-ray.ts.net')).toBe('abc');
    expect(redeemCode).toHaveBeenCalledWith('https://deimos.pitta-ray.ts.net', '7KQ4-M9XZ');
  });

  it('reports unreachable without ever redeeming the code', async () => {
    const probeMachine = vi.fn().mockResolvedValue(null);
    const redeemCode = vi.fn();

    const outcome = await pairMachine(
      'https://deimos.pitta-ray.ts.net',
      '7KQ4-M9XZ',
      probeMachine,
      redeemCode,
    );

    expect(outcome).toEqual({ ok: false, reason: 'unreachable' });
    expect(redeemCode).not.toHaveBeenCalled();
  });

  it('reports rejected for an expired or already-used code', async () => {
    const probeMachine = vi.fn().mockResolvedValue({ projects: [], pendingUpdateVersion: null });
    const redeemCode = vi.fn().mockResolvedValue(null);

    const outcome = await pairMachine(
      'https://deimos.pitta-ray.ts.net',
      '7KQ4-M9XZ',
      probeMachine,
      redeemCode,
    );

    expect(outcome).toEqual({ ok: false, reason: 'rejected' });
  });
});

describe('buildMachineLink', () => {
  it('carries machine and token onto the pairing origin', () => {
    expect(
      buildMachineLink('https://deimos.pitta-ray.ts.net', 'abc', 'https://preview.example', ''),
    ).toBe('https://preview.example/?machine=https%3A%2F%2Fdeimos.pitta-ray.ts.net&token=abc');
  });

  it('keeps a mount prefix and omits a missing token', () => {
    expect(
      buildMachineLink('https://deimos.pitta-ray.ts.net', '', 'http://app.test', '/paper-camp'),
    ).toBe('http://app.test/paper-camp?machine=https%3A%2F%2Fdeimos.pitta-ray.ts.net');
  });
});
