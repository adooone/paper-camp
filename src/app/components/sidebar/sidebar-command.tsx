import { ListItem } from '@dendelion/paper-ui';
import type { ReactNode } from 'react';

interface SidebarCommandProps {
  icon: ReactNode;
  children: ReactNode;
  note?: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  busy?: string;
  tone?: 'danger';
  className?: string;
}

export const SidebarCommand = ({
  icon,
  children,
  note,
  onClick,
  disabled,
  busy,
  tone,
  className,
}: SidebarCommandProps) => {
  const isDisabled = disabled || Boolean(busy);
  const toneClass = tone === 'danger' ? 'text-watercolor-rose-dark' : '';

  return (
    <div className="flex flex-col gap-0.5">
      <ListItem
        size="small"
        icon={<span className={toneClass}>{icon}</span>}
        onClick={onClick}
        disabled={isDisabled}
        className={`pc-row text-xs ${toneClass} ${isDisabled ? 'opacity-50' : ''} ${className ?? ''}`}
      >
        {busy ?? children}
      </ListItem>
      {note && <div className="text-2xs text-ink-300 font-mono px-2">{note}</div>}
    </div>
  );
};
