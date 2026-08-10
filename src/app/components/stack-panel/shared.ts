import { oneLineErrorSummary } from '@/app/utils/error-summary';

export const sectionLabelClassName =
  'font-display-luminari text-base font-semibold text-desk-text-muted mb-3';

export const groupLabelClassName =
  'font-display-luminari text-xs font-semibold uppercase tracking-wide text-desk-text-muted mb-2';

export const chalkStatusFill = {
  pass: '#2d5a3b',
  fail: '#5a2d2d',
  running: '#5a4a2d',
} as const;

export const chalkStatusText = {
  pass: '#b5d6b5',
  fail: '#d6a0a0',
  running: '#d6c4a0',
} as const;

export const gitErrorSummary = oneLineErrorSummary;
