import { describe, expect, it } from 'vitest';
import { pickHidden } from './status-bar-overflow';

const items = [
  { key: 'refresh', priority: 1, width: 90 },
  { key: 'git', priority: 2, width: 28 },
  { key: 'setup', priority: 5, width: 70 },
];

describe('pickHidden', () => {
  it('hides nothing when everything fits', () => {
    expect(pickHidden(600, 200, items, 28, 12)).toEqual(new Set());
  });

  it('hides the lowest priority first and pays for the menu button once', () => {
    // 200 fixed + (90+12) + (28+12) + (70+12) = 424; at 400, dropping refresh (102)
    // and adding the menu (40) leaves 362.
    expect(pickHidden(400, 200, items, 28, 12)).toEqual(new Set(['refresh']));
  });

  it('keeps hiding in priority order until the rest fit', () => {
    expect(pickHidden(330, 200, items, 28, 12)).toEqual(new Set(['refresh', 'git']));
    expect(pickHidden(250, 200, items, 28, 12)).toEqual(new Set(['refresh', 'git', 'setup']));
  });
});
