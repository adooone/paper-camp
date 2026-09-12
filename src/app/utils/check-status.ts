import type { DeskCheckState } from '@/types/index';

// Desk checks carry their own name from the manifest (IDEA-263) — no fixed
// Quality/Tests/Consistency vocabulary to keep in sync with it.
export const failingCheckNames = (deskChecks: DeskCheckState[]): string[] =>
  deskChecks.filter((check) => check.status === 'fail').map((check) => check.name);
