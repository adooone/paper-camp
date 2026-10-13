import { Button, CheckIcon, ChevronRightIcon, Menu } from '@dendelion/paper-ui';
import type { GroupMode } from '../helpers';

const GROUP_OPTIONS: { value: GroupMode; label: string }[] = [
  { value: 'plain', label: 'Plain' },
  { value: 'subject', label: 'Subject' },
  { value: 'project', label: 'Project' },
];

interface GroupSelectProps {
  group: GroupMode;
  onChange: (group: GroupMode) => void;
  showProject: boolean;
}

export const GroupSelect = ({ group, onChange, showProject }: GroupSelectProps) => {
  const options = showProject
    ? GROUP_OPTIONS
    : GROUP_OPTIONS.filter((option) => option.value !== 'project');
  const current = GROUP_OPTIONS.find((option) => option.value === group) ?? GROUP_OPTIONS[1];

  return (
    <Menu
      align="end"
      trigger={
        <Button variant="ghost" size="small" className="shrink-0 whitespace-nowrap">
          <span className="opacity-60">Group:</span> {current.label}
          <span className="ml-1 inline-flex rotate-90 opacity-60">
            <ChevronRightIcon size={12} />
          </span>
        </Button>
      }
      items={options.map((option) => ({
        id: option.value,
        label: option.label,
        icon: option.value === group ? <CheckIcon size={14} /> : <span className="w-[14px]" />,
        onSelect: () => onChange(option.value),
      }))}
    />
  );
};
