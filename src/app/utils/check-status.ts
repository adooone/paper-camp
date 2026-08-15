import type { StatusState } from '@/app/services/status-api';
import type { CheckStatus, DeskCheckState } from '@/types/index';

export interface DerivedCheckStatuses {
  qualityStatus: CheckStatus;
  testStatus: CheckStatus;
  consistencyStatus: CheckStatus;
}

const deskCheckStatus = (deskChecks: DeskCheckState[], name: string): CheckStatus =>
  deskChecks.find((c) => c.name === name)?.status ?? 'stale';

// Quality/Tests come from `desk.checks` (IDEA-162) — `pnpm lint` already covers
// formatting (`biome check .`), so there's no separate format check to combine.
export function deriveCheckStatuses(
  status: StatusState | null | undefined,
  deskChecks: DeskCheckState[],
): DerivedCheckStatuses {
  return {
    qualityStatus: deskCheckStatus(deskChecks, 'lint'),
    testStatus: deskCheckStatus(deskChecks, 'test'),
    consistencyStatus: status?.consistency?.status ?? 'stale',
  };
}

export interface DerivedBuildStatus {
  buildStatus: CheckStatus;
  lastBuilt: string | null;
}

// Separate from deriveCheckStatuses: build is a manual desk action, not part of
// the commit-gate stamps (Quality/Tests/Consistency).
export function deriveBuildStatus(status: StatusState | null | undefined): DerivedBuildStatus {
  return {
    buildStatus: status?.build?.status ?? 'stale',
    lastBuilt: status?.build?.lastRun ?? null,
  };
}
