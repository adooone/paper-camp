import type { CapabilityStatus, DefaultAgentKey, NotificationSettingKind } from '@/types/index';
import { color, colors, withAlpha } from '@dendelion/folk-ui/tokens';

export const TASK_TYPE_LABELS: Record<DefaultAgentKey, { label: string; detail: string }> = {
  build: { label: 'Build', detail: 'Phase runs, fixes and conflicts' },
  plan: { label: 'Plan', detail: 'Plan drafts, idea extends, desk discovery, review passes' },
  chat: { label: 'Chat', detail: 'Scout chat and PR code review' },
  quick: { label: 'Quick', detail: 'Commit messages, overlap checks, prioritising' },
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
  'batch-paused': 'Queue paused',
  'batch-finished': 'Queue finished',
  'agent-signed-out': 'Claude signed out',
};

export const PERMISSION_STAMP: Record<
  NotificationPermission,
  { variant: 'success' | 'warning' | 'error'; label: string }
> = {
  granted: { variant: 'success', label: 'Allowed' },
  default: { variant: 'warning', label: 'Not requested' },
  denied: { variant: 'error', label: 'Blocked' },
};
