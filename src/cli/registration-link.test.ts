import { describe, expect, it } from 'vitest';
import { buildRegistrationLink } from './registration-link';

describe('buildRegistrationLink', () => {
  it('carries the runtime origin and pairing token as query params', () => {
    expect(buildRegistrationLink(3333, 'abc123')).toBe(
      'http://localhost:3333/?runtime=http%3A%2F%2Flocalhost%3A3333&token=abc123',
    );
  });

  it('is adopted back into the same runtime URL and token by the client', async () => {
    const { loadRuntimeConnection } = await import('../app/services/runtime-connection');
    const link = buildRegistrationLink(4444, 'def456');
    const search = link.slice(link.indexOf('?'));
    expect(loadRuntimeConnection({ search }, null)).toEqual({
      runtimeUrl: 'http://localhost:4444',
      pairingToken: 'def456',
    });
  });
});
