import type { ServiceState } from '@/types/index';
import { describe, expect, it } from 'vitest';
import { serviceActions } from './services-group';

const service = (overrides: Partial<ServiceState> = {}): ServiceState => ({
  name: 'app',
  cmd: 'pnpm dev',
  hasHealthcheck: true,
  status: 'stopped',
  health: 'unknown',
  pid: 1234,
  startedAt: null,
  exitCode: null,
  ...overrides,
});

describe('serviceActions', () => {
  it('offers start for a stopped service', () => {
    expect(serviceActions(service({ status: 'stopped', pid: null }))).toEqual(['start']);
  });

  it('offers start for a crashed service', () => {
    expect(serviceActions(service({ status: 'crashed', exitCode: 1, pid: null }))).toEqual([
      'start',
    ]);
  });

  it('offers stop and restart for a running owned service', () => {
    expect(serviceActions(service({ status: 'running', health: 'up' }))).toEqual([
      'stop',
      'restart',
    ]);
  });

  it('offers nothing for an external service', () => {
    expect(serviceActions(service({ status: 'running', health: 'up', pid: null }))).toEqual([]);
  });

  it('offers nothing while stopping', () => {
    expect(serviceActions(service({ status: 'stopping' }))).toEqual([]);
  });
});
