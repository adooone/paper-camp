import { describe, expect, it } from 'vitest';
import { hasChosenProject, runtimeAdditionUrl } from './hub';

describe('hasChosenProject', () => {
  it('is false for a hosted client with no paired runtime', () => {
    expect(hasChosenProject('', '')).toBe(false);
  });

  it('is true when paper-camp dev serves this bundle from inside a repo', () => {
    expect(hasChosenProject('/paper-camp', '')).toBe(true);
  });

  it('is true for a hosted client paired to a runtime', () => {
    expect(hasChosenProject('', 'http://localhost:3333')).toBe(true);
  });
});

describe('runtimeAdditionUrl', () => {
  it('carries a pasted runtime address as the same query param a registration link uses', () => {
    expect(runtimeAdditionUrl('/', 'http://localhost:3333')).toBe(
      '/?runtime=http%3A%2F%2Flocalhost%3A3333',
    );
  });

  it('preserves the current path', () => {
    expect(runtimeAdditionUrl('/some/path', 'http://localhost:4444')).toBe(
      '/some/path?runtime=http%3A%2F%2Flocalhost%3A4444',
    );
  });
});
