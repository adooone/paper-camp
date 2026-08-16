import { color } from '@/app/styles/tokens';
import { Stamp, type StampVariant, Tooltip } from '@dendelion/paper-ui';
import type { ReactNode } from 'react';

export const sectionLabelClassName =
  'font-display-luminari text-base font-semibold text-desk-text-muted mb-3';

export const groupLabelClassName =
  'font-display-luminari text-xs font-semibold uppercase tracking-wide text-desk-text-muted mb-2';

export const chalkStatusFill = {
  pass: color.chalkPass,
  fail: color.chalkFail,
  running: color.chalkRunning,
} as const;

export const chalkStatusText = {
  pass: color.chalkPassText,
  fail: color.chalkFailText,
  running: color.chalkRunningText,
} as const;

export const StampButton = ({
  tooltip,
  onClick,
  disabled,
  disabledCursor = 'not-allowed',
  ariaExpanded,
  fillColor,
  textColor,
  variant,
  children,
}: {
  tooltip: string;
  onClick: () => void;
  disabled: boolean;
  disabledCursor?: 'not-allowed' | 'default';
  ariaExpanded?: boolean;
  fillColor?: string;
  textColor?: string;
  variant?: StampVariant;
  children: ReactNode;
}) => (
  <Tooltip content={tooltip} surface="chalkboard">
    {/* Raw <button>: the clickable target is a Stamp, which has no button surface of its own. */}
    <button
      type="button"
      className={`inline-flex border-none bg-transparent bg-none p-0 ${
        disabled
          ? disabledCursor === 'default'
            ? 'cursor-default'
            : 'cursor-not-allowed'
          : 'cursor-pointer enabled:hover:-translate-y-px enabled:hover:brightness-[1.15]'
      }`}
      onClick={onClick}
      disabled={disabled}
      aria-expanded={ariaExpanded}
    >
      <Stamp
        surface="chalkboard"
        size="small"
        fillColor={fillColor}
        textColor={textColor}
        variant={variant}
      >
        {children}
      </Stamp>
    </button>
  </Tooltip>
);

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
