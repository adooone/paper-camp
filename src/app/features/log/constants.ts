import type { LogRowOutcome, LogRowType } from '@/types/index';
import type { StampVariant } from '@dendelion/paper-ui';

export const LOG_PAGE_SIZE = 100;

export const HIGHLIGHT_OUTLINE_CLASS = 'outline-[rgba(200,154,90,0.5)]';

export const LOG_TYPE_LABELS: Record<LogRowType, string> = {
  phase: 'Phase run',
  audit: 'Audit',
  'batch-reconcile': 'Batch reconcile',
  'batch-draft': 'Batch draft',
  'run-all': 'Run all phases',
  draft: 'Draft',
  extend: 'Extend',
  suggest: 'Suggest ideas',
  'commit-suggest': 'Commit suggest',
  'overlap-check': 'Overlap check',
  prioritise: 'Prioritise queue',
  sync: 'Sync',
  reconcile: 'Reconcile',
  'fix-review': 'Fix review',
  'resolve-conflict': 'Resolve conflict',
  feedback: 'Feedback reply',
  'pr-review': 'PR review',
  'issue-fix': 'Issue fix',
  'desk-discovery': 'Desk discovery',
  'agent-run': 'Agent run',
  check: 'Check',
};

export const LOG_OUTCOME_VARIANT: Record<LogRowOutcome, StampVariant> = {
  done: 'success',
  error: 'error',
  superseded: 'warning',
  running: 'info',
  open: 'error',
};
