import type { ReactNode } from 'react';

const SETTING_ROW_GRID_CLASS =
  'grid grid-cols-[minmax(0,1fr)_260px] gap-3 items-center max-[480px]:grid-cols-1 max-[480px]:gap-1';

interface SettingRowProps {
  label: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
}

export const SettingRow = ({ label, hint, children }: SettingRowProps) => (
  <div className="plan-row-card">
    <div className={SETTING_ROW_GRID_CLASS}>
      <div className="min-w-0">
        <div className="overflow-hidden text-ellipsis whitespace-nowrap">{label}</div>
        {hint && <div className="text-sm opacity-45 mt-0.5">{hint}</div>}
      </div>
      <div className="flex justify-end max-[480px]:justify-start">{children}</div>
    </div>
  </div>
);
