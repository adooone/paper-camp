import {
  AGENT_LABELS,
  AGENT_OPTIONS,
  type AgentConfig,
  type AgentId,
  DEFAULT_AGENTS,
  DEFAULT_NOTIFICATION_KINDS,
  type DefaultAgentKey,
  type DefaultAgentsMap,
  type NotificationSettingKind,
  type PaperCampConfig,
} from '@/types/index';
import type { StampMeaning } from '../ui/stamp';
import { TEXT_SCALE_ORDER, type TextScaleId } from '../ui/typography';

export type PushPermission = NotificationPermission | 'unsupported';

export const AGENT_ROLES: readonly DefaultAgentKey[] = ['build', 'plan', 'chat', 'quick'];

export const AGENT_ROLE_LABELS: Record<DefaultAgentKey, { title: string; detail: string }> = {
  build: { title: 'Build', detail: 'Phase runs, fixes and conflicts' },
  plan: { title: 'Plan', detail: 'Plan drafts, idea extends, desk discovery, review passes' },
  chat: { title: 'Chat', detail: 'Scout chat and PR code review' },
  quick: { title: 'Quick', detail: 'Commit messages, overlap checks, prioritising' },
};

export const NOTIFICATION_KIND_LABELS: Record<
  NotificationSettingKind,
  { title: string; detail: string }
> = {
  'run-finished': { title: 'Run finished', detail: 'A phase or task completed' },
  'run-failed': { title: 'Run failed', detail: 'A run ended with an error' },
  'run-interrupted': { title: 'Run interrupted', detail: 'A run was stopped before it finished' },
  'check-failed': { title: 'Check failed', detail: 'Lint, tests or a build went red' },
  'question-parked': { title: 'Question parked', detail: 'An agent is waiting on an answer' },
  'pr-review-changes-requested': {
    title: 'PR changes requested',
    detail: 'A pull request review asked for changes',
  },
  'night-review-findings': { title: 'Night findings', detail: 'The night shift found something' },
  'service-stopped': { title: 'Service stopped', detail: 'A desk service went down' },
  'reply-posted': { title: 'Reply posted', detail: 'An agent replied in chat' },
  'batch-paused': { title: 'Queue paused', detail: 'A run-all queue stopped partway' },
  'batch-finished': {
    title: 'Queue finished',
    detail: 'A run-all queue worked through every idea',
  },
  'agent-signed-out': { title: 'Claude signed out', detail: 'The agent needs signing in again' },
};

export const discoverLabel = (discovering: boolean, configured: boolean): string =>
  discovering ? 'Discovering…' : configured ? 'Re-scan with discovery' : 'Discover from project';

export const DESK_PAGES: readonly { label: string; detail: string; path: string }[] = [
  { label: 'Classic desk', detail: 'The full desk, every page', path: '/' },
  { label: 'Docs', detail: 'How Paper Camp works', path: '/docs' },
  { label: 'Roadmap', detail: 'Ideas and plans across the desk', path: '/roadmap' },
  { label: 'Stats', detail: 'Runs, costs and timings', path: '/stats' },
];

const PUSH_STAMPS: Record<PushPermission, { meaning: StampMeaning; label: string }> = {
  granted: { meaning: 'done', label: 'allowed' },
  default: { meaning: 'parked', label: 'asking' },
  denied: { meaning: 'failed', label: 'off' },
  unsupported: { meaning: 'idle', label: 'unavailable' },
};

export const pushStamp = (permission: PushPermission) => PUSH_STAMPS[permission];

export const notificationKinds = (
  config: PaperCampConfig,
): Record<NotificationSettingKind, boolean> => ({
  ...DEFAULT_NOTIFICATION_KINDS,
  ...config.notifications?.kinds,
});

export const resolvedAgents = (config: PaperCampConfig): DefaultAgentsMap => ({
  ...DEFAULT_AGENTS,
  ...config.defaultAgents,
});

export const describeAgent = (agent: AgentConfig): string =>
  [AGENT_LABELS[agent.agent], agent.model, agent.effort].filter(Boolean).join(' · ');

export const scaleAtRatio = (ratio: number): TextScaleId => {
  const last = TEXT_SCALE_ORDER.length - 1;
  const clamped = Math.min(1, Math.max(0, ratio));
  return TEXT_SCALE_ORDER[Math.round(clamped * last)];
};

export const scaleStep = (current: TextScaleId, direction: 1 | -1): TextScaleId => {
  const index = TEXT_SCALE_ORDER.indexOf(current) + direction;
  return TEXT_SCALE_ORDER[Math.min(TEXT_SCALE_ORDER.length - 1, Math.max(0, index))];
};

export const scaleRatio = (scale: TextScaleId): number =>
  TEXT_SCALE_ORDER.indexOf(scale) / (TEXT_SCALE_ORDER.length - 1);

export const switchAgent = (current: AgentConfig, agent: AgentId): AgentConfig => {
  const { model: models, effort: efforts } = AGENT_OPTIONS[agent];
  const keepsModel = current.model && (!models || models.includes(current.model));
  const model = keepsModel ? current.model : models?.[0];
  const effort = Array.isArray(efforts) ? (current.effort ?? efforts[0]) : undefined;
  return { agent, ...(model && { model }), ...(effort && { effort }) };
};

export const daemonDetail = (version: string | null): string =>
  version ? `Daemon ${version}` : 'Daemon version unknown';
