import type { CapabilityStatus, NotificationSettingKind } from '@/types/index';
import { color, colors, withAlpha } from '@dendelion/paper-ui/tokens';

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
  nightShift: 'Review passes',
};

export const CAPABILITY_STATUS_STAMP: Record<
  CapabilityStatus,
  { fill: string; text: string; label: string }
> = {
  ok: { fill: colors.primaryWash, text: color.accentGreenDark, label: 'Ready' },
  warn: {
    fill: withAlpha(colors.accentAmber, 0.25),
    text: color.accentAmberDark,
    label: 'Needs attention',
  },
  missing: {
    fill: withAlpha(colors.accentRose, 0.25),
    text: color.accentRoseDark,
    label: 'Missing',
  },
};

export const MERGE_POLICY_STAMP: Record<'upToDate' | 'outdated', { fill: string; text: string }> = {
  upToDate: { fill: colors.primaryWash, text: color.accentGreenDark },
  outdated: { fill: withAlpha(colors.accentAmber, 0.25), text: color.accentAmberDark },
};

export const VERSION_STAMP_FILL = colors.primaryWash;

export const NOTIFICATION_KIND_LABELS: Record<NotificationSettingKind, string> = {
  'run-finished': 'Run finished',
  'run-failed': 'Run failed',
  'run-interrupted': 'Run interrupted',
  'check-failed': 'Check failed',
  'question-parked': 'Question parked',
  'pr-review-changes-requested': 'PR review requested changes',
  'night-review-findings': 'Review findings',
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
