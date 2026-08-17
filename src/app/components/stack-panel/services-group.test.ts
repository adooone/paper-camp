import type { ServiceState } from '@/types/index';
import { describe, expect, it } from 'vitest';
import { dotClass } from './services-group';

const service = (overrides: Partial<ServiceState> = {}): ServiceState => ({
  name: 'app',
  cmd: 'pnpm dev',
  hasHealthcheck: true,
  status: 'stopped',
  health: 'unknown',
  pid: null,
  startedAt: null,
  exitCode: null,
  ...overrides,
});

describe('dotClass', () => {
  it('reads crashed as fail-coloured regardless of health', () => {
    expect(dotClass(service({ status: 'crashed' }))).toBe('bg-chalk-fail-text');
  });

  it('reads a healthy running service as pass-coloured', () => {
    expect(dotClass(service({ status: 'running', health: 'up' }))).toBe('bg-chalk-pass-text');
  });

  it('reads an unhealthy running service as running-coloured', () => {
    expect(dotClass(service({ status: 'running', health: 'down' }))).toBe('bg-chalk-running-text');
  });

  it('reads a running service with unknown health as running-coloured', () => {
    expect(dotClass(service({ status: 'running', health: 'unknown' }))).toBe(
      'bg-chalk-running-text',
    );
  });

  it('reads stopping as running-coloured', () => {
    expect(dotClass(service({ status: 'stopping' }))).toBe('bg-chalk-running-text');
  });

  it('reads stopped as muted', () => {
    expect(dotClass(service({ status: 'stopped' }))).toBe('bg-desk-text-muted');
  });
});
