import type { ReactNode } from 'react';

interface PageTitleProps {
  children: ReactNode;
}

// paper-ui's compiled CSS resets h1-h6 to inherit (Tailwind preflight), hence this override.
export const PageTitle = ({ children }: PageTitleProps) => {
  return (
    <h1 className="text-4xl font-display-luminari font-semibold text-ink-900 mb-6 leading-[1.1]">
      {children}
    </h1>
  );
};
