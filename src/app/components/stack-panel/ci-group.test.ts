import type { CiReleaseState, DraftPrReadiness } from '@/types/index';
import { describe, expect, it } from 'vitest';
import { draftPrSecretsMissing, versionLine } from './ci-group';

const ci = (overrides: Partial<CiReleaseState> = {}): CiReleaseState => ({
  repo: 'o/r',
  branch: 'main',
  available: true,
  fetchedAt: '2026-10-18T14:05:00.000Z',
  runs: [],
  releasePlease: false,
  releasePr: null,
  releasedVersion: '0.52.0',
  draftPr: null,
  ...overrides,
});

describe('versionLine', () => {
  it('shows just the released version when release-please is off', () => {
    expect(versionLine(ci({ releasePlease: false }))).toBe('0.52.0');
  });

  it('shows "nothing queued" when release-please is on with no open PR', () => {
    expect(versionLine(ci({ releasePlease: true }))).toBe('0.52.0 · nothing queued');
  });

  it('shows the queued version when release-please has an open PR', () => {
    expect(
      versionLine(
        ci({
          releasePlease: true,
          releasePr: { number: 9, title: 't', url: 'u', version: '0.53.0' },
        }),
      ),
    ).toBe('0.52.0 · 0.53.0 queued');
  });

  it('uses an em dash for an unknown released version', () => {
    expect(versionLine(ci({ releasedVersion: null }))).toBe('—');
  });
});

const draftPr = (overrides: Partial<DraftPrReadiness> = {}): DraftPrReadiness => ({
  scoutAppId: true,
  scoutPrivateKey: true,
  secretsChecked: true,
  lastRun: null,
  ...overrides,
});

describe('draftPrSecretsMissing', () => {
  it('is false when both secrets are present', () => {
    expect(draftPrSecretsMissing(draftPr())).toBe(false);
  });

  it('is true when a secret is missing and the check succeeded', () => {
    expect(draftPrSecretsMissing(draftPr({ scoutAppId: false }))).toBe(true);
  });

  it('is false when the secrets call failed, even though both read as absent', () => {
    expect(
      draftPrSecretsMissing(
        draftPr({ scoutAppId: false, scoutPrivateKey: false, secretsChecked: false }),
      ),
    ).toBe(false);
  });
});
