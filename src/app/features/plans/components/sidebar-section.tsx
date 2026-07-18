import { fontFamily, fontSize, space } from '@/app/styles/tokens';
import type { ReactNode } from 'react';

interface SidebarSectionProps {
  label: string;
  children: ReactNode;
  action?: ReactNode;
}

export const SidebarSection = ({ label, children, action }: SidebarSectionProps) => {
  return (
    <div style={{ marginBottom: space[5] }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '0.35rem',
          padding: `0 ${space[3]}`,
        }}
      >
        <span
          style={{
            fontFamily: fontFamily.handwritten,
            fontSize: fontSize.xs,
            fontWeight: 600,
            lineHeight: 1,
            opacity: 0.45,
          }}
        >
          {label}
        </span>
        {action}
      </div>
      {children}
    </div>
  );
};
