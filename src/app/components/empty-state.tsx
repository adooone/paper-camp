import type { ReactNode } from 'react';

interface EmptyStateProps {
  message: ReactNode;
  illustration?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export const EmptyState = ({ message, illustration, action, className = '' }: EmptyStateProps) => (
  <div className={`flex flex-col items-center gap-3 text-center ${className}`}>
    {illustration && (
      <div className="text-[var(--pui-text-secondary)]" aria-hidden="true">
        {illustration}
      </div>
    )}
    <p className="m-0 font-handwritten text-base text-[var(--pui-text-secondary)]">{message}</p>
    {action}
  </div>
);
