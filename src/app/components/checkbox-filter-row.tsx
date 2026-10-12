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

export const CheckboxFilterRow = ({
  label,
  checked,
  disabled,
  count,
  ariaLabel,
  onChange,
  trailing,
}: CheckboxFilterRowProps) => (
  <div className="flex min-h-[26px] items-center gap-2 px-2">
    <Checkbox
      size="small"
      checked={checked}
      disabled={disabled}
      onChange={onChange}
      aria-label={ariaLabel}
    />
    <span className={`min-w-0 flex-1 truncate text-sm ${checked ? '' : 'opacity-60'}`}>
      {label}
    </span>
    {count != null && <span className="shrink-0 text-2xs opacity-60">{count}</span>}
    {trailing}
  </div>
);
