import { describe, expect, it, vi } from 'vitest';
import {
  hasChosenProject,
  pickableTailnetPeers,
  runtimeAdditionUrl,
  runtimeRowLabel,
  servesOwnRuntime,
} from './hub';

describe('hasChosenProject', () => {
  it('is false for a hosted client with no paired runtime and no GitHub source', () => {
    expect(hasChosenProject('', '', false)).toBe(false);
  });

  it('is true when paper-camp dev serves this bundle from inside a repo', () => {
    expect(hasChosenProject('/paper-camp', '', false)).toBe(true);
  });

  it('is true for a hosted client paired to a runtime', () => {
    expect(hasChosenProject('', 'http://localhost:3333', false)).toBe(true);
  });

  it('is true for a hosted client pointed at a GitHub corpus source', () => {
    expect(hasChosenProject('', '', true)).toBe(true);
  });
});

describe('runtimeAdditionUrl', () => {
  it('carries a pasted runtime address as the same query param a registration link uses', () => {
    expect(runtimeAdditionUrl('/', 'http://localhost:3333')).toBe(
      '/?runtime=http%3A%2F%2Flocalhost%3A3333',
    );
  });

  it('preserves the current path', () => {
    expect(runtimeAdditionUrl('/some/path', 'http://localhost:4444')).toBe(
      '/some/path?runtime=http%3A%2F%2Flocalhost%3A4444',
    );
  });
});

describe('runtimeRowLabel', () => {
  it('shortens a runtime URL to its host', () => {
    expect(runtimeRowLabel('http://localhost:3333')).toBe('localhost:3333');
  });

  it('falls back to the raw value for an unparsable address', () => {
    expect(runtimeRowLabel('not-a-url')).toBe('not-a-url');
  });
});

describe('pickableTailnetPeers', () => {
  const peers = [
    { runtimeUrl: 'http://phobos.pitta-ray.ts.net:3333' },
    { runtimeUrl: 'http://io.pitta-ray.ts.net:3333' },
  ];

  it('keeps every discovered peer when none are already added', () => {
    expect(pickableTailnetPeers(peers, [])).toEqual(peers);
  });

  it('drops a peer whose runtimeUrl is already in the registry', () => {
    expect(pickableTailnetPeers(peers, ['http://phobos.pitta-ray.ts.net:3333'])).toEqual([
      { runtimeUrl: 'http://io.pitta-ray.ts.net:3333' },
    ]);
  });
});

describe('servesOwnRuntime', () => {
  const jsonResponse = { ok: true, json: async () => ({ capabilities: [] }) };
  // A static host rewrites unknown paths to index.html: 200, but HTML.
  const htmlResponse = {
    ok: true,
    json: async () => {
      throw new SyntaxError('Unexpected token <');
    },
  };

  it('is true when the page origin answers the API with JSON', async () => {
    await expect(servesOwnRuntime('', async () => jsonResponse)).resolves.toBe(true);
  });

  it('is false when the origin returns a static SPA fallback instead of the API', async () => {
    await expect(servesOwnRuntime('', async () => htmlResponse)).resolves.toBe(false);
  });

  it('is false when the origin has no API at all', async () => {
    await expect(
      servesOwnRuntime('', async () => ({ ok: false, json: async () => ({}) })),
    ).resolves.toBe(false);
  });

  it('is false when the request itself fails', async () => {
    await expect(
      servesOwnRuntime('', async () => {
        throw new TypeError('Failed to fetch');
      }),
    ).resolves.toBe(false);
  });

  it('does not probe when an explicit runtime is already dialled', async () => {
    const probe = vi.fn();
    await expect(servesOwnRuntime('http://localhost:3333', probe)).resolves.toBe(false);
    expect(probe).not.toHaveBeenCalled();
  });
});
