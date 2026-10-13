interface PlansHeaderProps {
  /** Rows the list shows right now; omitted while it loads. */
  count?: number;
}

export const PlansHeader = ({ count }: PlansHeaderProps) => (
  <div className="mb-4 flex items-baseline gap-3">
    <h1 className="m-0 font-display-luminari text-4xl font-semibold leading-[1.1] text-ink-900">
      Ideas
    </h1>
    {count !== undefined && (
      <span className="font-handwritten text-base opacity-60">
        {count} {count === 1 ? 'idea' : 'ideas'}
      </span>
    )}
  </div>
);
