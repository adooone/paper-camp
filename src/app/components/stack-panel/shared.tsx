import { color } from '@dendelion/folk-ui/tokens';

export const groupLabelClassName =
  'font-handwritten text-sm tracking-wide text-desk-text-muted mb-2';

export const TASK_CARD_HEIGHT_CLASS = 'h-[4.625rem]';
export const CAPACITY_CARD_HEIGHT_CLASS = 'h-[6.125rem]';

export const chalkStatusText = {
  pass: color.chalkPassText,
  fail: color.chalkFailText,
  running: color.chalkRunningText,
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
