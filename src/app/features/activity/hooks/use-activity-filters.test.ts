import { describe, expect, it } from 'vitest';
import { toggleInAll } from './use-activity-filters';

describe('toggleInAll', () => {
  const all = ['done', 'error', 'open'];

  it('unticking from "all" leaves every other value selected', () => {
    expect(toggleInAll([], all, 'error')).toEqual(['done', 'open']);
  });

  it('ticking the last missing value back returns to "all"', () => {
    expect(toggleInAll(['done', 'open'], all, 'error')).toEqual([]);
  });

  it('toggles a value inside an explicit selection', () => {
    expect(toggleInAll(['done'], all, 'open')).toEqual(['done', 'open']);
    expect(toggleInAll(['done', 'open'], all, 'done')).toEqual(['open']);
  });
});
