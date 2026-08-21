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

  it('is ready for a corpus module via a configured GitHub token, even mid-probe', () => {
    expect(
      moduleReadiness('corpus', { reachable: false, checking: true }, { githubConfigured: true }),
    ).toBe('ready');
  });

  it('is ready for a corpus module once the runtime is reachable, with no GitHub token', () => {
    expect(
      moduleReadiness('corpus', { reachable: true, checking: false }, { githubConfigured: false }),
    ).toBe('ready');
  });

  it('is unreachable for a corpus module when neither the runtime nor GitHub is available', () => {
    expect(
      moduleReadiness('corpus', { reachable: false, checking: false }, { githubConfigured: false }),
    ).toBe('unreachable');
  });
});
