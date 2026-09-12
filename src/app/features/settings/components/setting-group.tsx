import type { ReactNode } from 'react';

const settingGroupLabelClass =
  'font-handwritten text-xs font-semibold opacity-55 leading-none pt-2 pr-1 pb-0 pl-1';

interface SettingGroupProps {
  label: string;
  action?: ReactNode;
  children: ReactNode;
}

export const SettingGroup = ({ label, action, children }: SettingGroupProps) => (
  <div className="flex flex-col gap-1">
    <div className="flex items-center justify-between gap-2">
      <span className={settingGroupLabelClass}>{label}</span>
      {action}
    </div>
    {children}
  </div>
);
