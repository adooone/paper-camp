import type { RuntimeConnection } from '@/app/services/runtime-connection';
import { describe, expect, it } from 'vitest';
import { fanOutRuntimes } from '../fan-out';

function runtime(runtimeUrl: string): RuntimeConnection {
  return { runtimeUrl, pairingToken: null };
}

describe('fanOutRuntimes', () => {
  it('composes what every reachable runtime answers', async () => {
    const runtimes = [runtime('http://localhost:3333'), runtime('http://localhost:4444')];
    const result = await fanOutRuntimes(runtimes, async (url) => `data from ${url}`);
    expect(result).toEqual([
      { runtime: runtimes[0], data: 'data from http://localhost:3333' },
      { runtime: runtimes[1], data: 'data from http://localhost:4444' },
    ]);
  });

  it('drops an unreachable runtime rather than failing the whole fan-out', async () => {
    const reachable = runtime('http://localhost:3333');
    const unreachable = runtime('http://localhost:9999');
    const result = await fanOutRuntimes([reachable, unreachable], async (url) =>
      url === reachable.runtimeUrl ? 'ok' : null,
    );
    expect(result).toEqual([{ runtime: reachable, data: 'ok' }]);
  });

  it('is empty for an empty registry', async () => {
    const result = await fanOutRuntimes([], async () => 'unreachable in practice');
    expect(result).toEqual([]);
  });
});
