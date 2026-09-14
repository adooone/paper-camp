export const DESK_CHECK_GRID_CLASS =
  'grid grid-cols-[minmax(140px,1fr)_minmax(140px,1fr)_minmax(140px,1fr)_32px] gap-3 items-center';

export const DeskCheckRowHeader = () => (
  <div className="plan-row-card">
    <div className="overflow-x-auto">
      <div className={DESK_CHECK_GRID_CLASS}>
        <span className="font-handwritten text-sm opacity-60 whitespace-nowrap">Name</span>
        <span className="font-handwritten text-sm opacity-60 whitespace-nowrap">Command</span>
        <span className="font-handwritten text-sm opacity-60 whitespace-nowrap">Fix command</span>
        <span />
      </div>
    </div>
  </div>
);
