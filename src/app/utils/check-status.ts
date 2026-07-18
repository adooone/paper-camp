import type { StatusState } from '@/app/services/status-api';
import type { CheckStatus } from '@/types/index';

function combine(statuses: CheckStatus[]): CheckStatus {
  if (statuses.includes('running')) return 'running';
  if (statuses.includes('fail')) return 'fail';
  if (statuses.every((s) => s === 'stale')) return 'stale';
  return 'pass';
}

export interface DerivedCheckStatuses {
  qualityStatus: CheckStatus;
  testStatus: CheckStatus;
  consistencyStatus: CheckStatus;
}

export function deriveCheckStatuses(status: StatusState | null | undefined): DerivedCheckStatuses {
  return {
    qualityStatus: combine([status?.lint?.status ?? 'stale', status?.format?.status ?? 'stale']),
    testStatus: status?.test?.status ?? 'stale',
    consistencyStatus: status?.consistency?.status ?? 'stale',
  };
}
