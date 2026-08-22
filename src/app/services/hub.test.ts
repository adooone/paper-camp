import { describe, expect, it } from 'vitest';
import { hasChosenProject } from './hub';

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
