import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadMachineConnection, readMachineConnection } from './machine-connection';
import { listMachines } from './machine-store';

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
