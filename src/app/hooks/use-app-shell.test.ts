import { describe, expect, it } from 'vitest';
import { shouldShowUsageFallback } from './use-app-shell';

describe('shouldShowUsageFallback', () => {
  it('stays on / when the session opened on /settings/setup, navigated to /, and the probe resolves with an incomplete capability', () => {
    const openedPathname: string = '/settings/setup';
    const pathnameAtResolve = '/';
    expect(shouldShowUsageFallback(openedPathname === '/', pathnameAtResolve, 1, 0)).toBe(false);
  });

  it('redirects when the session opened on / and is still there when the probe resolves', () => {
    const openedPathname: string = '/';
    const pathnameAtResolve = '/';
    expect(shouldShowUsageFallback(openedPathname === '/', pathnameAtResolve, 1, 0)).toBe(true);
  });

  it('does not redirect if the pathname moved on before the probe resolved', () => {
    expect(shouldShowUsageFallback(true, '/plans/1', 1, 0)).toBe(false);
  });

  it('does not redirect once the corpus has real plans or more than the seeded idea', () => {
    expect(shouldShowUsageFallback(true, '/', 2, 0)).toBe(false);
    expect(shouldShowUsageFallback(true, '/', 1, 1)).toBe(false);
  });
});
