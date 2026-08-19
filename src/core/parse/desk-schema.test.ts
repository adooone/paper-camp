import { describe, expect, it } from 'vitest';
import { deskConfigSchema, paperCampConfigSchema } from './schemas';

describe('deskConfigSchema', () => {
  it('accepts a full manifest with services, checks, and ci', () => {
    const result = deskConfigSchema.safeParse({
      services: [
        { name: 'app', cmd: 'pnpm dev', port: 3333, healthcheck: 'http://localhost:3333/' },
        { name: 'lib', cmd: 'pnpm dev:lib' },
      ],
      checks: [{ name: 'types', cmd: 'pnpm check-types' }],
      ci: { repo: 'adooone/paper-camp', branch: 'main', releasePlease: true },
    });
    expect(result.success).toBe(true);
  });

  it('accepts an empty manifest', () => {
    expect(deskConfigSchema.safeParse({}).success).toBe(true);
  });

  it('rejects a service missing cmd', () => {
    expect(deskConfigSchema.safeParse({ services: [{ name: 'app' }] }).success).toBe(false);
  });

  it('rejects a non-positive port', () => {
    expect(
      deskConfigSchema.safeParse({ services: [{ name: 'app', cmd: 'x', port: 0 }] }).success,
    ).toBe(false);
  });

  it('rejects ci without a repo', () => {
    expect(deskConfigSchema.safeParse({ ci: { branch: 'main' } }).success).toBe(false);
  });
});

describe('paperCampConfigSchema desk field', () => {
  it('validates an embedded desk manifest', () => {
    const result = paperCampConfigSchema.safeParse({
      version: 1,
      projectName: 'paper-camp',
      initializedAt: '2026-04-29T00:00:00.000Z',
      desk: { checks: [{ name: 'types', cmd: 'pnpm check-types' }] },
    });
    expect(result.success).toBe(true);
  });
});
