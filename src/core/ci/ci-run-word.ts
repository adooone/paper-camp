import type { CiRunStatus } from '../../types/index';

const CI_RUN_WORDS: Record<CiRunStatus, string> = {
  success: 'passed',
  failure: 'failed',
  in_progress: 'running',
  queued: 'queued',
  cancelled: 'cancelled',
  unknown: 'unknown',
};

export function ciRunWord(status: CiRunStatus): string {
  return CI_RUN_WORDS[status];
}
