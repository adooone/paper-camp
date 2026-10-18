import type { ServiceState } from '@/types/index';
import { describe, expect, it } from 'vitest';
import { serviceFacts } from './service-page';

const service = (overrides: Partial<ServiceState> = {}): ServiceState => ({
  name: 'app',
  cmd: 'pnpm dev',
  hasHealthcheck: false,
  status: 'stopped',
  health: 'unknown',
  pid: null,
  startedAt: null,
  exitCode: null,
  ...overrides,
});

const labels = (s: ServiceState) => serviceFacts(s).map((fact) => fact.label);

describe('serviceFacts', () => {
  it('shows only the command for a never-started service', () => {
    expect(labels(service())).toEqual(['Command']);
    expect(serviceFacts(service())[0].value).toBe('pnpm dev');
  });

  it('adds PID and Started while running', () => {
    const facts = serviceFacts(
      service({ status: 'running', pid: 4321, startedAt: '2026-10-18T09:30:00.000Z' }),
    );
    expect(facts.map((fact) => fact.label)).toEqual(['Command', 'PID', 'Started']);
    expect(facts[1].value).toBe('4321');
  });

  it('adds Health only when a healthcheck is declared', () => {
    expect(labels(service({ hasHealthcheck: true, health: 'up' }))).toContain('Health');
    expect(labels(service({ health: 'up' }))).not.toContain('Health');
  });

  it('adds Last exit after a crash', () => {
    const facts = serviceFacts(service({ status: 'crashed', exitCode: 137 }));
    expect(facts.at(-1)).toEqual({ label: 'Last exit', value: '137' });
  });
});
