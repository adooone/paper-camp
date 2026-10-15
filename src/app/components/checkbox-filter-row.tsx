import { Checkbox } from '@dendelion/folk-ui';
import type { ReactNode } from 'react';

export interface CheckboxFilterRowProps {
  label: string;
  checked: boolean;
  disabled?: boolean;
  count?: number | string | null;
  ariaLabel: string;
  onChange: () => void;
  trailing?: ReactNode;
}

// The label stretches to the count so the whole row toggles, truncating a long name.
const labelClass = 'min-w-0 flex-1 [&>span:last-child]:min-w-0 [&>span:last-child]:truncate';

export const CheckboxFilterRow = ({
  label,
  checked,
  disabled,
  count,
  ariaLabel,
  onChange,
  trailing,
}: CheckboxFilterRowProps) => (
  <div className="flex min-h-[26px] items-center gap-2 pr-2">
    <Checkbox
      size="small"
      label={label}
      checked={checked}
      disabled={disabled}
      onChange={onChange}
      aria-label={ariaLabel}
      className={labelClass}
    />
    {count != null && <span className="shrink-0 text-2xs opacity-60">{count}</span>}
    {trailing}
  </div>
);
