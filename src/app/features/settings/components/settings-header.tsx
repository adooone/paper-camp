import type { ReactNode } from 'react';

interface SettingsHeaderProps {
  title: string;
  children?: ReactNode;
}

export const SettingsHeader = ({ title, children }: SettingsHeaderProps) => (
  <div className="flex items-center gap-3 mb-6 flex-wrap">
    <h1 className="text-4xl flex-1 font-display-luminari font-semibold text-ink-900 m-0 leading-[1.1]">
      {title}
    </h1>
    {children}
  </div>
);
