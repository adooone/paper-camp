import type { DraftPrReadiness } from '@/types/index';
import { describe, expect, it } from 'vitest';
import { scoutSecretsValue } from './desk-ci-editor';

const draftPr = (overrides: Partial<DraftPrReadiness> = {}): DraftPrReadiness => ({
  scoutAppId: true,
  scoutPrivateKey: true,
  secretsChecked: true,
  lastRun: null,
  ...overrides,
});

describe('scoutSecretsValue', () => {
  it('says both secrets are present', () => {
    expect(scoutSecretsValue(draftPr())).toBe('SCOUT_APP_ID and SCOUT_PRIVATE_KEY present');
  });

  it('names a single missing secret', () => {
    expect(scoutSecretsValue(draftPr({ scoutAppId: false }))).toBe('missing: SCOUT_APP_ID');
  });

  it('names both missing secrets', () => {
    expect(scoutSecretsValue(draftPr({ scoutAppId: false, scoutPrivateKey: false }))).toBe(
      'missing: SCOUT_APP_ID, SCOUT_PRIVATE_KEY',
    );
  });

  it('reports an unanswered check when the secrets call failed', () => {
    expect(
      scoutSecretsValue(
        draftPr({ scoutAppId: false, scoutPrivateKey: false, secretsChecked: false }),
      ),
    ).toBe("couldn't check — needs admin on the repo");
  });

  it('reports an unanswered check when there is no draft-PR state', () => {
    expect(scoutSecretsValue(null)).toBe("couldn't check — needs admin on the repo");
  });
});
