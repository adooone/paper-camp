import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { addMachine, listMachines, removeMachine } from './machine-store';

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

describe('machine-store', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', new FakeLocalStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('lists no machines when nothing is stored', () => {
    expect(listMachines()).toEqual([]);
  });

  it('adds a machine and lists it back', () => {
    addMachine('https://100.80.79.13:4333');
    expect(listMachines()).toEqual(['https://100.80.79.13:4333']);
  });

  it('accumulates distinct machines in the order they were added', () => {
    addMachine('https://alpha.example.com');
    addMachine('https://beta.example.com');
    expect(listMachines()).toEqual(['https://alpha.example.com', 'https://beta.example.com']);
  });

  it('does not duplicate an already-remembered machine', () => {
    addMachine('https://alpha.example.com');
    addMachine('https://alpha.example.com');
    expect(listMachines()).toEqual(['https://alpha.example.com']);
  });

  it('dedupes a trailing slash against the same machine without one', () => {
    addMachine('https://alpha.example.com');
    addMachine('https://alpha.example.com/');
    expect(listMachines()).toEqual(['https://alpha.example.com']);
  });

  it('removes a remembered machine', () => {
    addMachine('https://alpha.example.com');
    addMachine('https://beta.example.com');
    removeMachine('https://alpha.example.com');
    expect(listMachines()).toEqual(['https://beta.example.com']);
  });

  it('removes a machine addressed with a trailing slash', () => {
    addMachine('https://alpha.example.com');
    removeMachine('https://alpha.example.com/');
    expect(listMachines()).toEqual([]);
  });

  it('tolerates removing a machine that was never added', () => {
    expect(() => removeMachine('https://unknown.example.com')).not.toThrow();
    expect(listMachines()).toEqual([]);
  });

  it('degrades to an empty list when localStorage throws', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('unavailable');
      },
      setItem: () => {
        throw new Error('unavailable');
      },
      removeItem: () => {
        throw new Error('unavailable');
      },
    });
    expect(() => addMachine('https://alpha.example.com')).not.toThrow();
    expect(() => removeMachine('https://alpha.example.com')).not.toThrow();
    expect(listMachines()).toEqual([]);
  });
});
