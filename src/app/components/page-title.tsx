import { color, fontFamily, space } from '@/app/styles/tokens';
import type { ReactNode } from 'react';

interface PageTitleProps {
  children: ReactNode;
}

// paper-ui's compiled CSS resets h1-h6 to inherit (Tailwind preflight), hence this override.
export const PageTitle = ({ children }: PageTitleProps) => {
  return (
    <h1
      className="text-4xl"
      style={{
        fontFamily: fontFamily.serif,
        fontWeight: 600,
        color: color.textPrimary,
        margin: `0 0 ${space[6]}`,
        lineHeight: 1.1,
      }}
    >
      {children}
    </h1>
  );
};
