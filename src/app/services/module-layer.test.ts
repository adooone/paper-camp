import { describe, expect, it } from 'vitest';
import { moduleReadiness } from './module-layer';

describe('moduleReadiness', () => {
  it('is ready when a module declares no layer (client-composed content)', () => {
    expect(moduleReadiness(undefined, { reachable: false, checking: false })).toBe('ready');
  });

  it('is ready when a module declares client and needs nothing from the runtime', () => {
    expect(moduleReadiness('client', { reachable: false, checking: true })).toBe('ready');
  });

  it('is checking while a runtime module waits out the reachability probe', () => {
    expect(moduleReadiness('runtime', { reachable: false, checking: true })).toBe('checking');
  });

  it('is ready once a runtime module confirms the runtime is reachable', () => {
    expect(moduleReadiness('runtime', { reachable: true, checking: false })).toBe('ready');
  });

  it('is unreachable when a runtime module confirms the runtime is not', () => {
    expect(moduleReadiness('runtime', { reachable: false, checking: false })).toBe('unreachable');
  });
});
