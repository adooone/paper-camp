import { Button, CheckIcon, ChevronRightIcon, Menu } from '@dendelion/folk-ui';
import { HANDWRITTEN_ACTION_CLASS } from './sidebar-action';

interface InlineSelectOption {
  value: string;
  label: string;
}

interface InlineSelectProps {
  value: string;
  options: InlineSelectOption[];
  onChange: (value: string) => void;
  ariaLabel: string;
}

/** A value read in place, in the handwritten action voice, with a menu for the
 *  alternatives — for selects that sit inside dense rows such as table cells. */
export const InlineSelect = ({ value, options, onChange, ariaLabel }: InlineSelectProps) => {
  const current = options.find((option) => option.value === value);
  return (
    <Menu
      align="end"
      trigger={
        <Button
          variant="ghost"
          size="small"
          aria-label={`${ariaLabel}: ${current?.label ?? value}`}
          className={`whitespace-nowrap ${HANDWRITTEN_ACTION_CLASS}`}
        >
          {current?.label ?? value}
          <span className="ml-1 inline-flex rotate-90 opacity-60">
            <ChevronRightIcon size={12} />
          </span>
        </Button>
      }
      items={options.map((option) => ({
        id: option.value === '' ? '__default__' : option.value,
        label: option.label,
        icon: option.value === value ? <CheckIcon size={14} /> : <span className="w-[14px]" />,
        onSelect: () => onChange(option.value),
      }))}
    />
  );
};
