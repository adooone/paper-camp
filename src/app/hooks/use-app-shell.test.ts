import { describe, expect, it } from 'vitest';
import { type SidebarAreaFlags, computeHasSidebar, shouldShowUsageFallback } from './use-app-shell';

const baseFlags: SidebarAreaFlags = {
  pathname: '/',
  isPlansArea: false,
  isIdeasListArea: false,
  isActivityListArea: false,
  isChatArea: false,
  isProjectArea: false,
  isGitArea: false,
};

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

describe('computeHasSidebar', () => {
  it('shows a sidebar on /chat, as IDEA-293 specified', () => {
    expect(computeHasSidebar({ ...baseFlags, pathname: '/chat', isChatArea: true })).toBe(true);
  });

  it('shows a sidebar on the root ideas list', () => {
    expect(
      computeHasSidebar({ ...baseFlags, pathname: '/', isPlansArea: true, isIdeasListArea: true }),
    ).toBe(true);
  });

  it('shows no sidebar when no area flag is set', () => {
    expect(computeHasSidebar({ ...baseFlags, pathname: '/settings' })).toBe(false);
  });
});
