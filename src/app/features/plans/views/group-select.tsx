import { Select } from '@dendelion/paper-ui';
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

  return (
    <div className="flex shrink-0 items-center gap-1">
      <span className="font-handwritten text-xs font-semibold opacity-55 leading-none whitespace-nowrap">
        Group:
      </span>
      <Select
        size="small"
        value={group === 'horizon' ? 'subject' : group}
        options={options}
        width={116}
        onChange={(value) => onChange(value as GroupMode)}
      />
    </div>
  );
};
