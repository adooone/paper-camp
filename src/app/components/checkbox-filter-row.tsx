import { Checkbox } from '@dendelion/paper-ui';
import type { ReactNode } from 'react';

export interface CheckboxFilterRowProps {
  label: string;
  checked: boolean;
  disabled?: boolean;
  count?: number | null;
  ariaLabel: string;
  onChange: () => void;
  trailing?: ReactNode;
}

// The label stretches to the count so the whole row toggles; -my-1.5 lets the 40px
// hover area overlap its neighbours so rows sit 28px apart.
const labelClass =
  '-my-1.5 min-w-0 flex-1 gap-2 [&>span:last-child]:min-w-0 [&>span:last-child]:truncate [&>span:last-child]:text-sm';

export const CheckboxFilterRow = ({
  label,
  checked,
  disabled,
  count,
  ariaLabel,
  onChange,
  trailing,
}: CheckboxFilterRowProps) => (
  <div className="flex items-center gap-2 pr-2">
    <Checkbox
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
