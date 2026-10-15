import { Button } from '@dendelion/folk-ui';
import type { ReactNode } from 'react';

/** The handwritten ghost voice for small secondary actions (All, Clear, Group). */
export const HANDWRITTEN_ACTION_CLASS = 'font-handwritten !text-sm opacity-70';

interface SidebarActionProps {
  children: ReactNode;
  onClick: () => void;
}

export const SidebarAction = ({ children, onClick }: SidebarActionProps) => (
  <Button
    variant="ghost"
    size="small"
    onClick={onClick}
    className={`h-auto px-1.5 py-0.5 ${HANDWRITTEN_ACTION_CLASS}`}
  >
    {children}
  </Button>
);
