export type GroupMode = 'plain' | 'subject' | 'project';

const GROUP_MODES: GroupMode[] = ['plain', 'subject', 'project'];

export const DEFAULT_GROUP_MODE: GroupMode = 'subject';

export const isGroupMode = (value: unknown): value is GroupMode =>
  typeof value === 'string' && GROUP_MODES.includes(value as GroupMode);
