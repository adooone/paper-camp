import type { ReactNode } from 'react';

interface EmptyStateProps {
  message: ReactNode;
  action?: ReactNode;
  className?: string;
}

export const EmptyState = ({ message, action, className = '' }: EmptyStateProps) => (
  <div className={`flex flex-col items-center gap-3 py-6 text-center ${className}`}>
    <p className="m-0 font-handwritten text-base opacity-60">{message}</p>
    {action}
  </div>
);
