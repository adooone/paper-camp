import type { CheckStatus, DeskCheckState } from '@/types/index';

export interface DerivedCheckStatuses {
  qualityStatus: CheckStatus;
  testStatus: CheckStatus;
  consistencyStatus: CheckStatus;
}

const deskCheckStatus = (deskChecks: DeskCheckState[], name: string): CheckStatus =>
  deskChecks.find((c) => c.name === name)?.status ?? 'stale';

// Quality/Tests/Consistency all come from `desk.checks` (IDEA-162) — `pnpm lint`
// already covers formatting (`biome check .`), so there's no separate format check.
export function deriveCheckStatuses(deskChecks: DeskCheckState[]): DerivedCheckStatuses {
  return {
    qualityStatus: deskCheckStatus(deskChecks, 'lint'),
    testStatus: deskCheckStatus(deskChecks, 'test'),
    consistencyStatus: deskCheckStatus(deskChecks, 'Consistency'),
  };
}
