import { describe, expect, it } from 'vitest';
import { versionLabel } from './version-footer';

describe('versionLabel', () => {
  it('shows the runtime version when it matches the client', () => {
    expect(versionLabel('0.28.4', '0.28.4')).toBe('Paper Camp v0.28.4');
  });

  it('shows both versions when they differ', () => {
    expect(versionLabel('0.28.4', '0.29.0')).toBe('Paper Camp v0.28.4 · client v0.29.0');
  });

  it('falls back to the client version before the runtime has answered', () => {
    expect(versionLabel(null, '0.29.0')).toBe('Paper Camp v0.29.0');
  });
});
