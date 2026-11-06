import type { ReactNode } from 'react';

interface PlansHeaderProps {
  /** Rows the list shows right now; omitted while it loads. */
  count?: number;
  actions?: ReactNode;
}

export const PlansHeader = ({ count, actions }: PlansHeaderProps) => (
  <div className="mb-4 flex min-w-0 items-center gap-3">
    <div className="flex min-w-0 items-baseline gap-3">
      <h1 className="m-0 font-display-luminari text-4xl font-semibold leading-[1.1] text-ink-900">
        Ideas
      </h1>
      {count !== undefined && (
        <span className="whitespace-nowrap font-handwritten text-base opacity-60">
          {count} {count === 1 ? 'idea' : 'ideas'}
        </span>
      )}
    </div>
    {actions && (
      <div className="ml-auto flex shrink-0 items-center gap-2 whitespace-nowrap">{actions}</div>
    )}
  </div>
);
