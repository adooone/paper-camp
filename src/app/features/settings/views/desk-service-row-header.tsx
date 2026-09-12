import { Card } from '@dendelion/paper-ui';

export const DESK_SERVICE_GRID_CLASS =
  'grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_80px_minmax(0,1fr)_32px] gap-3 items-center max-[480px]:grid-cols-1 max-[480px]:gap-1';

export const DeskServiceRowHeader = () => (
  <Card size="small" texture="kraft" className="plan-row-card">
    <div className={DESK_SERVICE_GRID_CLASS}>
      <span className="font-handwritten text-sm opacity-60 whitespace-nowrap">Name</span>
      <span className="font-handwritten text-sm opacity-60 whitespace-nowrap">Command</span>
      <span className="font-handwritten text-sm opacity-60 whitespace-nowrap">Port</span>
      <span className="font-handwritten text-sm opacity-60 whitespace-nowrap">Healthcheck</span>
      <span />
    </div>
  </Card>
);
