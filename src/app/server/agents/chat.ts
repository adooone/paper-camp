import type { ChatPermissionAsk, RunUsage } from '@/types/index';

export interface ParsedChatLine {
  sessionId?: string;
  messageStart?: boolean;
  delta?: string;
  text?: string;
  tools?: string[];
  permissions?: ChatPermissionAsk[];
  done?: boolean;
  error?: boolean;
  result?: string;
  reason?: string;
  usage?: RunUsage;
}

const LABEL_LIMIT = 80;

export function clip(value: string): string {
  const line = value.split('\n')[0].trim();
  return line.length > LABEL_LIMIT ? `${line.slice(0, LABEL_LIMIT - 1)}…` : line;
}

export function stringField(
  input: Record<string, unknown> | undefined,
  ...keys: string[]
): string | undefined {
  for (const key of keys) {
    const value = input?.[key];
    if (typeof value === 'string' && value.trim()) return clip(value);
  }
  return undefined;
}

const PAPER_CAMP_TOOL_LABELS: Record<string, (id?: string, title?: string) => string> = {
  add_idea: (_id, title) => (title ? `Filing an idea: ${title}` : 'Filing an idea'),
  draft_plan: (_id, title) => (title ? `Drafting a plan: ${title}` : 'Drafting a plan'),
  append_note: (id) => `Posting to ${id ?? 'an idea'}`,
  append_decision: (id) => `Recording a decision on ${id ?? 'an idea'}`,
  append_log: (id) => `Logging on ${id ?? 'an idea'}`,
  append_clarification: (id) => `Answering ${id ?? 'an idea'}'s question`,
  update_phase: (id) => `Updating a phase of ${id ?? 'an idea'}`,
  edit_idea: (id) => `Editing ${id ?? 'an idea'}`,
  archive_entity: (id) => `Archiving ${id ?? 'an idea'}`,
  get_plan: (id) => `Reading ${id ?? 'an idea'}`,
  list_plans: () => 'Listing ideas',
};

export function describePaperCampTool(name: string, input?: Record<string, unknown>): string {
  const label = PAPER_CAMP_TOOL_LABELS[name];
  if (!label) return `Using paper-camp ${name.replace(/_/g, ' ')}`;
  return label(stringField(input, 'id'), stringField(input, 'title'));
}
