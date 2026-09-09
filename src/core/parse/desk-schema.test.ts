import { describe, expect, it } from 'vitest';
import { deskConfigSchema, paperCampConfigSchema } from './schemas';

describe('deskConfigSchema', () => {
  it.each<[string, unknown, boolean]>([
    [
      'accepts a full manifest with services, checks, and ci',
      {
        services: [
          { name: 'app', cmd: 'pnpm dev', port: 3333, healthcheck: 'http://localhost:3333/' },
          { name: 'lib', cmd: 'pnpm dev:lib' },
        ],
        checks: [{ name: 'types', cmd: 'pnpm check-types' }],
        ci: { repo: 'adooone/paper-camp', branch: 'main', releasePlease: true },
      },
      true,
    ],
    ['accepts an empty manifest', {}, true],
    ['rejects a service missing cmd', { services: [{ name: 'app' }] }, false],
    ['rejects a non-positive port', { services: [{ name: 'app', cmd: 'x', port: 0 }] }, false],
    ['rejects ci without a repo', { ci: { branch: 'main' } }, false],
  ])('%s', (_description, input, expected) => {
    expect(deskConfigSchema.safeParse(input).success).toBe(expected);
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
