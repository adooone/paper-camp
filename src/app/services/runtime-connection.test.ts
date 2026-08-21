import { describe, expect, it } from 'vitest';
import { readRuntimeConnection } from './runtime-connection';

describe('readRuntimeConnection', () => {
  it('is empty when paper-camp dev serves this same bundle locally', () => {
    expect(readRuntimeConnection({ search: '' })).toEqual({
      runtimeUrl: '',
      pairingToken: null,
    });
  });

  it('is empty when there is no location at all', () => {
    expect(readRuntimeConnection(null)).toEqual({ runtimeUrl: '', pairingToken: null });
  });

  it('reads a detached runtime URL with no pairing token', () => {
    expect(readRuntimeConnection({ search: '?runtime=http%3A%2F%2Flocalhost%3A3333' })).toEqual({
      runtimeUrl: 'http://localhost:3333',
      pairingToken: null,
    });
  });

  it('reads a detached runtime URL alongside its pairing token', () => {
    expect(
      readRuntimeConnection({
        search: '?runtime=http%3A%2F%2Flocalhost%3A3333&token=abc123',
      }),
    ).toEqual({ runtimeUrl: 'http://localhost:3333', pairingToken: 'abc123' });
  });
});
