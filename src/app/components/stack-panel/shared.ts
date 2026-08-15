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
