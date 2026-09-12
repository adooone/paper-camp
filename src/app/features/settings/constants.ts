import type { CapabilityStatus, NotificationSettingKind } from '@/types/index';

export const TASK_TYPE_KEYS = [
  'phase',
  'planDraft',
  'ideaExtend',
  'commitSuggest',
  'feedback',
  'codeReview',
  'deskDiscovery',
  'nightShift',
] as const;
export type TaskTypeKey = (typeof TASK_TYPE_KEYS)[number];

export const TASK_TYPE_LABELS: Record<TaskTypeKey, string> = {
  phase: 'Phase run',
  planDraft: 'Plan draft',
  ideaExtend: 'Idea extend',
  commitSuggest: 'Commit suggest',
  feedback: 'Scout chat',
  codeReview: 'Code review',
  deskDiscovery: 'Desk discovery',
  nightShift: 'Night shift',
};

export const CAPABILITY_STATUS_STAMP: Record<
  CapabilityStatus,
  { fill: string; text: string; label: string }
> = {
  ok: { fill: 'rgba(143, 185, 150, 0.25)', text: '#5E8A66', label: 'Ready' },
  warn: { fill: 'rgba(212, 163, 115, 0.25)', text: '#A67B4F', label: 'Needs attention' },
  missing: { fill: 'rgba(201, 139, 139, 0.25)', text: '#6E3A3A', label: 'Missing' },
};

export const MERGE_POLICY_STAMP: Record<'upToDate' | 'outdated', { fill: string; text: string }> = {
  upToDate: { fill: 'rgba(143, 185, 150, 0.25)', text: '#5E8A66' },
  outdated: { fill: 'rgba(212, 163, 115, 0.25)', text: '#A67B4F' },
};

export const VERSION_STAMP_FILL = 'rgba(143, 185, 150, 0.25)';

export const NOTIFICATION_KIND_LABELS: Record<NotificationSettingKind, string> = {
  'run-finished': 'Run finished',
  'run-failed': 'Run failed',
  'run-interrupted': 'Run interrupted',
  'check-failed': 'Check failed',
  'question-parked': 'Question parked',
  'pr-review-changes-requested': 'PR review requested changes',
  'night-review-findings': 'Night review findings',
  'service-stopped': 'Service stopped',
  'reply-posted': 'Reply posted',
};

export const PERMISSION_STAMP: Record<
  NotificationPermission,
  { variant: 'success' | 'warning' | 'error'; label: string }
> = {
  granted: { variant: 'success', label: 'Allowed' },
  default: { variant: 'warning', label: 'Not requested' },
  denied: { variant: 'error', label: 'Blocked' },
};
