import { describe, expect, it } from 'vitest';
import type { ServiceState } from '../types/index';
import { SERVICE_DOT_CLASS, serviceStatus } from './service-status';

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

describe('serviceStatus', () => {
  it('reads stopped as muted', () => {
    expect(serviceStatus(service())).toEqual({ word: 'stopped', tone: 'muted' });
  });

  it('reads a running service awaiting its first health answer as starting', () => {
    expect(serviceStatus(service({ status: 'running', health: 'unknown' }))).toEqual({
      word: 'starting',
      tone: 'running',
    });
  });

  it('reads a healthy running service as running', () => {
    expect(serviceStatus(service({ status: 'running', health: 'up' }))).toEqual({
      word: 'running',
      tone: 'pass',
    });
  });

  it('reads a running service without a healthcheck as running', () => {
    expect(
      serviceStatus(service({ status: 'running', health: 'unknown', hasHealthcheck: false })),
    ).toEqual({ word: 'running', tone: 'pass' });
  });

  it('reads a running service whose healthcheck answers down as unhealthy', () => {
    expect(serviceStatus(service({ status: 'running', health: 'down' }))).toEqual({
      word: 'unhealthy',
      tone: 'fail',
    });
  });

  it('reads stopping as stopping', () => {
    expect(serviceStatus(service({ status: 'stopping' }))).toEqual({
      word: 'stopping',
      tone: 'running',
    });
  });

  it('reads crashed with the exit code', () => {
    expect(serviceStatus(service({ status: 'crashed', exitCode: 137 }))).toEqual({
      word: 'crashed · exit 137',
      tone: 'fail',
    });
  });

  it('reads a running service the panel did not start as external', () => {
    expect(serviceStatus(service({ status: 'running', health: 'up', pid: null }))).toEqual({
      word: 'external',
      tone: 'pass',
    });
  });
});

describe('SERVICE_DOT_CLASS', () => {
  it('maps each tone to its dot colour', () => {
    expect(SERVICE_DOT_CLASS).toEqual({
      muted: 'bg-desk-text-muted',
      running: 'bg-chalk-running-text',
      pass: 'bg-chalk-pass-text',
      fail: 'bg-chalk-fail-text',
    });
  });
});
