import { color, withAlpha } from '@dendelion/paper-ui/tokens';

export const sectionLabelClassName =
  'font-display-luminari text-base font-semibold text-desk-text-muted mb-3';

export const groupLabelClassName =
  'font-handwritten text-sm tracking-wide text-desk-text-muted mb-2';

export const chalkStatusFill = {
  pass: withAlpha(color.chalkPass, 0.16),
  fail: withAlpha(color.chalkFail, 0.16),
  running: withAlpha(color.chalkRunning, 0.1),
} as const;

export const chalkStatusText = {
  pass: color.chalkPass,
  fail: color.chalkFail,
  running: color.chalkRunning,
} as const;

const isSameDay = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

export const formatLastRun = (lastRun: string | null): string => {
  if (!lastRun) return '';
  const date = new Date(lastRun);
  const time = date.toLocaleTimeString();
  return isSameDay(date, new Date()) ? time : `${date.toLocaleDateString()} ${time}`;
};
