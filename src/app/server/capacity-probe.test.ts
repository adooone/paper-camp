import type { RateLimitSnapshot } from '@/types/index';
import { describe, expect, it, vi } from 'vitest';

const { mockSpawn } = vi.hoisted(() => ({ mockSpawn: vi.fn() }));
vi.mock('node:child_process', () => ({ spawn: mockSpawn }));

import { Readable } from 'node:stream';
import { probeCapacity } from './capacity-probe';

function fakeProc(lines: string[]) {
  const stdout = Readable.from(lines.map((l) => `${l}\n`));
  return {
    stdout,
    kill: vi.fn(),
    on: (event: string, cb: () => void) => {
      if (event === 'close') stdout.on('end', () => setImmediate(cb));
    },
  };
}

const EVENT = JSON.stringify({
  type: 'rate_limit_event',
  rate_limit_info: {
    status: 'allowed',
    unifiedWindows: { five_hour: { utilization: 0.11, resetsAt: 1_788_436_800 } },
  },
});

describe('probeCapacity', () => {
  it('resolves on the first rate_limit_event and kills the process', async () => {
    const proc = fakeProc(['{"type":"system","subtype":"init"}', EVENT]);
    mockSpawn.mockReturnValue(proc);
    const snapshot = (await probeCapacity('/tmp')) as RateLimitSnapshot;
    expect(snapshot.unifiedWindows?.five_hour?.utilization).toBe(0.11);
    expect(proc.kill).toHaveBeenCalled();
  });

  it('resolves null when the stream carries no rate limit', async () => {
    mockSpawn.mockReturnValue(fakeProc(['{"type":"system","subtype":"init"}']));
    expect(await probeCapacity('/tmp')).toBeNull();
  });
});
